import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from '../lib/supabase'
import { requireUser } from './auth'
import { parseExportAttendanceRecords, parseExportStudyLocations, parseExportStudyPreferences, parseExportStudySessionSegments, parseExportStudySessions, parseUuid } from './backup'
import type { CopyMode, Database, DateKey, DateRange, ExportAttendanceRecord, ExportPlanDay, ExportStudyLocation, ExportStudyPreferences, ExportStudySession, ExportStudySessionSegment, ExportTask, ImportResult, Json, StudyBloomExport } from '../types'
import { assertDateKey, enumerateDateKeys } from '../utils/date'
import { AppError, toAppError } from '../utils/errorMessage'

type TaskRow = Database['public']['Tables']['tasks']['Row']
type PlanDayRow = Database['public']['Tables']['plan_days']['Row']
export interface ImportOptions { mode?: CopyMode }

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object'

const parseInput = (input: string | StudyBloomExport): Record<string, unknown> => {
  if (typeof input !== 'string') return input as unknown as Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(input)
    if (!isRecord(parsed)) throw new Error('not object')
    return parsed
  } catch { throw new AppError('导入文件不是有效的 JSON', 'VALIDATION') }
}

const parseDate = (value: unknown): DateKey => {
  try { return assertDateKey(value) }
  catch { throw new AppError('导入数据包含无效日期', 'VALIDATION') }
}

const parseTasks = (value: unknown): ExportTask[] => {
  if (!Array.isArray(value)) throw new AppError('导入数据缺少 tasks 数组', 'VALIDATION')
  return value.map((item) => {
    if (!isRecord(item)) throw new AppError('任务数据格式不正确', 'VALIDATION')
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    if (!title || title.length > 100) throw new AppError('导入任务内容不正确', 'VALIDATION')
    const sortOrder = item.sortOrder === undefined ? 0 : Number(item.sortOrder)
    if (!Number.isInteger(sortOrder) || sortOrder < 0) throw new AppError('导入任务排序不正确', 'VALIDATION')
    const task: ExportTask = { planDate: parseDate(item.planDate), title, completed: Boolean(item.completed), sortOrder }
    if (item.estimatedMinutes !== undefined && item.estimatedMinutes !== null) {
      const estimatedMinutes = Number(item.estimatedMinutes)
      if (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 1 || estimatedMinutes > 1440) throw new AppError('导入任务预计时长不正确', 'VALIDATION')
      task.estimatedMinutes = estimatedMinutes
    } else task.estimatedMinutes = null
    if (item.id !== undefined) {
      const id = parseUuid(item.id)
      if (!id) throw new AppError('导入任务 ID 不正确', 'VALIDATION')
      task.id = id
    }
    return task
  })
}

const parsePlanDays = (value: unknown): ExportPlanDay[] => {
  if (!Array.isArray(value)) throw new AppError('导入数据缺少 planDays 数组', 'VALIDATION')
  const byDate = new Map<DateKey, ExportPlanDay>()
  value.forEach((item) => {
    if (!isRecord(item)) throw new AppError('计划日数据格式不正确', 'VALIDATION')
    const planDate = parseDate(item.planDate)
    const note = typeof item.note === 'string' ? item.note.trim() : ''
    if (note.length > 1000) throw new AppError('导入备注过长', 'VALIDATION')
    byDate.set(planDate, { planDate, isRestDay: Boolean(item.isRestDay), note })
  })
  return [...byDate.values()]
}

const rangeFromDates = (dates: DateKey[]): DateRange | null => {
  if (!dates.length) return null
  const sorted = [...dates].sort()
  return { startDate: sorted[0], endDate: sorted[sorted.length - 1] }
}

export async function exportPlan(range: DateRange): Promise<StudyBloomExport> {
  assertDateKey(range.startDate); assertDateKey(range.endDate)
  if (range.startDate > range.endDate) throw new AppError('导出日期范围不正确', 'VALIDATION')
  const user = await requireUser()
  try {
    const client = getSupabase()
    const [{ data: taskRows, error: taskError }, { data: planRows, error: planError }] = await Promise.all([
      client.from('tasks').select('*').eq('user_id', user.id).gte('plan_date', range.startDate).lte('plan_date', range.endDate).order('plan_date').order('sort_order'),
      client.from('plan_days').select('*').eq('user_id', user.id).gte('plan_date', range.startDate).lte('plan_date', range.endDate).order('plan_date'),
    ])
    if (taskError) throw taskError
    if (planError) throw planError
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks: (taskRows as TaskRow[]).map((row) => ({ planDate: row.plan_date, title: row.title, completed: row.completed, sortOrder: row.sort_order, estimatedMinutes: row.estimated_minutes })),
      planDays: (planRows as PlanDayRow[]).map((row) => ({ planDate: row.plan_date, isRestDay: row.is_rest_day, note: row.note ?? '' })),
    }
  } catch (error) { throw toAppError(error, '导出计划失败') }
}

export async function exportPlanJson(range: DateRange): Promise<string> { return JSON.stringify(await exportPlan(range), null, 2) }

interface StudyRestore {
  locations: ExportStudyLocation[]
  attendance: ExportAttendanceRecord[]
  sessions: ExportStudySession[]
  segments: ExportStudySessionSegment[]
  preferences: ExportStudyPreferences | null
}

const EMPTY_STUDY_RESTORE: StudyRestore = { locations: [], attendance: [], sessions: [], segments: [], preferences: null }

/**
 * Restores study rows append-safe: explicit ids + ignoreDuplicates make a
 * re-import a no-op, and FK parents go in first (locations → attendance →
 * sessions → segments). Rows whose FK target is missing from the file are
 * skipped (attendance) or nulled (sessions) instead of failing the import.
 * Returns the number of rows actually inserted.
 */
async function restoreStudyRecords(client: SupabaseClient<Database>, userId: string, study: StudyRestore, taskIds: Set<string>): Promise<number> {
  const defaultLocationId = study.locations.find((location) => location.isDefault)?.id ?? null
  const locationRows = study.locations.map((location) => ({
    id: location.id, user_id: userId, name: location.name, latitude: location.latitude, longitude: location.longitude,
    radius_m: location.radiusM, is_active: location.isActive, is_default: false,
  }))
  const locationIds = new Set(study.locations.map((location) => location.id))
  const attendanceRows = study.attendance
    .filter((record) => locationIds.has(record.locationId))
    .map((record) => ({
      id: record.id, user_id: userId, location_id: record.locationId,
      check_in_at: record.checkInAt, check_in_latitude: record.checkInLatitude, check_in_longitude: record.checkInLongitude,
      check_in_accuracy_m: record.checkInAccuracyM, check_in_distance_m: record.checkInDistanceM,
      check_out_at: record.checkOutAt, check_out_latitude: record.checkOutLatitude, check_out_longitude: record.checkOutLongitude,
      check_out_accuracy_m: record.checkOutAccuracyM, check_out_distance_m: record.checkOutDistanceM,
      manual_closed: record.manualClosed,
    }))
  const attendanceIds = new Set(attendanceRows.map((row) => row.id))
  const sessionRows = study.sessions.map((session) => ({
    id: session.id, user_id: userId,
    task_id: session.taskId && taskIds.has(session.taskId) ? session.taskId : null,
    task_title_snapshot: session.taskTitleSnapshot,
    attendance_record_id: session.attendanceRecordId && attendanceIds.has(session.attendanceRecordId) ? session.attendanceRecordId : null,
    plan_date: session.planDate, mode: session.mode, status: session.status,
    started_at: session.startedAt, ended_at: session.endedAt,
    pomodoro_focus_seconds: session.pomodoroFocusSeconds,
    pomodoro_short_break_seconds: session.pomodoroShortBreakSeconds,
    pomodoro_long_break_seconds: session.pomodoroLongBreakSeconds,
    pomodoro_rounds_before_long_break: session.pomodoroRoundsBeforeLongBreak,
    pomodoro_completed_rounds: session.pomodoroCompletedRounds,
    current_phase: session.currentPhase, current_round: session.currentRound,
    phase_started_at: session.phaseStartedAt, phase_ends_at: session.phaseEndsAt,
    phase_remaining_seconds: session.phaseRemainingSeconds,
  }))
  const sessionIds = new Set(study.sessions.map((session) => session.id))
  const segmentRows = study.segments
    .filter((segment) => sessionIds.has(segment.sessionId))
    .map((segment) => ({
      id: segment.id,
      session_id: segment.sessionId,
      segment_kind: segment.segmentKind,
      pomodoro_round: segment.pomodoroRound ?? null,
      pomodoro_completed_at: segment.pomodoroCompletedAt ?? null,
      started_at: segment.startedAt,
      ended_at: segment.endedAt,
    }))

  // 与部分唯一索引的冲突已由上方预检拦截；ignoreDuplicates 保证重复导入幂等。
  let restored = 0
  if (locationRows.length) {
    const { data, error } = await client.from('study_locations').upsert(locationRows, { onConflict: 'id', ignoreDuplicates: true }).select('id')
    if (error) throw error
    restored += data?.length ?? 0
  }
  if (attendanceRows.length || sessionRows.length || segmentRows.length) {
    const { data, error } = await client.rpc('restore_study_records', {
      p_attendance: attendanceRows as unknown as Json,
      p_sessions: sessionRows as unknown as Json,
      p_segments: segmentRows as unknown as Json,
    })
    if (error) throw error
    restored += data ?? 0
  }
  if (study.sessions.length) {
    const { error } = await client.rpc('restore_study_reflections', {
      p_sessions: study.sessions.map((session) => ({ id: session.id, reflection: session.reflection ?? '' })) as unknown as Json,
    })
    if (error) throw error
  }
  if (study.preferences) {
    const { error } = await client.from('study_preferences').upsert({
      user_id: userId,
      default_mode: study.preferences.defaultMode,
      focus_seconds: study.preferences.focusSeconds,
      short_break_seconds: study.preferences.shortBreakSeconds,
      long_break_seconds: study.preferences.longBreakSeconds,
      rounds_before_long_break: study.preferences.roundsBeforeLongBreak,
      sound_enabled: study.preferences.soundEnabled,
      vibration_enabled: study.preferences.vibrationEnabled,
      daily_goal_enabled: study.preferences.dailyGoalEnabled ?? true,
      daily_goal_minutes: study.preferences.dailyGoalMinutes ?? 120,
      countdown_enabled: study.preferences.countdownEnabled ?? false,
      countdown_title: study.preferences.countdownTitle ?? '考研初试',
      countdown_date: study.preferences.countdownDate ?? null,
    }, { onConflict: 'user_id' })
    if (error) throw error
  }
  if (defaultLocationId) {
    const { error: clearError } = await client.from('study_locations').update({ is_default: false }).eq('user_id', userId).eq('is_default', true)
    if (clearError) throw clearError
    const { error: defaultError } = await client.from('study_locations').update({ is_default: true }).eq('user_id', userId).eq('id', defaultLocationId)
    if (defaultError) throw defaultError
  }
  return restored
}

export async function importPlan(input: string | StudyBloomExport, options: ImportOptions = {}): Promise<ImportResult> {
  const payload = parseInput(input)
  const version = Number(payload.version ?? 1)
  if (version !== 1 && version !== 2) throw new AppError('不支持的导入文件版本', 'VALIDATION')
  const tasks = parseTasks(payload.tasks)
  const planDays = parsePlanDays(payload.planDays)
  const mode = options.mode ?? 'overwrite'
  if (mode !== 'overwrite' && mode !== 'append') throw new AppError('导入模式不正确', 'VALIDATION')
  const study: StudyRestore = version === 2 ? {
    locations: parseExportStudyLocations(payload.studyLocations),
    attendance: parseExportAttendanceRecords(payload.attendanceRecords),
    sessions: parseExportStudySessions(payload.studySessions),
    segments: parseExportStudySessionSegments(payload.studySessionSegments),
    preferences: parseExportStudyPreferences(payload.studyPreferences),
  } : EMPTY_STUDY_RESTORE
  const dates = [...new Set([...tasks.map((task) => task.planDate), ...planDays.map((day) => day.planDate)])]
  if (!dates.length && !study.locations.length && !study.attendance.length && !study.sessions.length && !study.segments.length && !study.preferences) {
    return { taskCount: 0, planDayCount: 0, studyRecordCount: 0 }
  }
  if (dates.length) {
    const range = rangeFromDates(dates)!
    enumerateDateKeys(range.startDate, range.endDate)
  }
  const user = await requireUser()
  try {
    const client = getSupabase()

    // v2 文件携带未结束记录时，若账号自己也有进行中记录，部分唯一索引会在
    // 写入中途抛错。任何删写之前先检查，给出可操作的中文错误。
    const fileOpenAttendance = study.attendance.some((record) => record.checkOutAt === null)
    const fileOpenSession = study.sessions.some((session) => session.endedAt === null)
    if (fileOpenAttendance || fileOpenSession) {
      const checks = await Promise.all([
        fileOpenAttendance
          ? client.from('attendance_records').select('id').eq('user_id', user.id).is('check_out_at', null).limit(1).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        fileOpenSession
          ? client.from('study_sessions').select('id').eq('user_id', user.id).is('ended_at', null).limit(1).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])
      for (const check of checks) if (check.error) throw check.error
      if (checks.some((check) => check.data)) {
        throw new AppError('导入文件包含未结束的签到或学习记录，请先结束当前进行中的记录再导入', 'CONFLICT')
      }
    }

    if (mode === 'overwrite' && dates.length) {
      const { error: taskDeleteError } = await client.from('tasks').delete().eq('user_id', user.id).in('plan_date', dates)
      if (taskDeleteError) throw taskDeleteError
      const { error: dayDeleteError } = await client.from('plan_days').delete().eq('user_id', user.id).in('plan_date', dates)
      if (dayDeleteError) throw dayDeleteError
    }

    let planDayCount = 0
    if (planDays.length) {
      let daysToInsert = planDays
      if (mode === 'append') {
        const { data: existing, error } = await client.from('plan_days').select('plan_date').eq('user_id', user.id).in('plan_date', dates)
        if (error) throw error
        const existingDates = new Set((existing ?? []).map((row) => row.plan_date))
        daysToInsert = planDays.filter((day) => !existingDates.has(day.planDate))
      }
      if (daysToInsert.length) {
        const { error } = await client.from('plan_days').insert(daysToInsert.map((day) => ({ user_id: user.id, plan_date: day.planDate, is_rest_day: day.isRestDay, note: day.note })))
        if (error) throw error
        planDayCount = daysToInsert.length
      }
    }

    let taskCount = 0
    if (tasks.length) {
      const offsets = new Map<DateKey, number>()
      if (mode === 'append') {
        const { data: existing, error } = await client.from('tasks').select('plan_date,sort_order').eq('user_id', user.id).in('plan_date', dates)
        if (error) throw error
        ;(existing ?? []).forEach((row) => offsets.set(row.plan_date, Math.max(offsets.get(row.plan_date) ?? -1, row.sort_order) + 1))
      }
      const rows = tasks.map((task) => {
        const offset = offsets.get(task.planDate) ?? 0
        if (mode === 'append') offsets.set(task.planDate, offset + 1)
        // id only present in version 2 files; keeping it lets sessions stay linked to their task.
        return { id: task.id, user_id: user.id, plan_date: task.planDate, title: task.title, completed: task.completed, sort_order: mode === 'append' ? offset : task.sortOrder, estimated_minutes: task.estimatedMinutes ?? null }
      })
      // v2 行带 id：upsert + ignoreDuplicates 让重复导入幂等；v1 无 id 走原 insert。
      if (tasks.every((task) => Boolean(task.id))) {
        const { error } = await client.from('tasks').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
        if (error) throw error
      } else {
        const { error } = await client.from('tasks').insert(rows)
        if (error) throw error
      }
      taskCount = tasks.length
    }

    const taskIds = new Set(tasks.flatMap((task) => (task.id ? [task.id] : [])))
    const studyRecordCount = await restoreStudyRecords(client, user.id, study, taskIds)
    return { taskCount, planDayCount, studyRecordCount }
  } catch (error) { throw toAppError(error, '导入计划失败') }
}

export const exportData = exportPlanJson
export const importData = importPlan
