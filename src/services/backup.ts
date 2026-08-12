import { getSupabase } from '../lib/supabase'
import type { Database, ExportAttendanceRecord, ExportPlanDay, ExportStudyLocation, ExportStudyPreferences, ExportStudySession, ExportStudySessionSegment, ExportTask, PomodoroPhase, SegmentKind, StudyBloomExport, StudyBloomExportV2, StudyMode, StudySessionStatus } from '../types'
import { LOCATION_LIMITS, POMODORO_LIMITS } from '../types'
import { AppError, toAppError } from '../utils/errorMessage'
import { assertDateKey } from '../utils/date'
import { requireUser } from './auth'

type TaskRow = Database['public']['Tables']['tasks']['Row']
type PlanDayRow = Database['public']['Tables']['plan_days']['Row']
type LocationRow = Database['public']['Tables']['study_locations']['Row']
type AttendanceRow = Database['public']['Tables']['attendance_records']['Row']
type SessionRow = Database['public']['Tables']['study_sessions']['Row']
type SegmentRow = Database['public']['Tables']['study_session_segments']['Row']
type PreferencesRow = Database['public']['Tables']['study_preferences']['Row']

function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Lowercased so FK-set lookups and upserts match regardless of file casing. */
export const parseUuid = (value: unknown): string | null =>
  typeof value === 'string' && UUID_RE.test(value) ? value.toLowerCase() : null

const requireUuid = (value: unknown, message: string): string => {
  const id = parseUuid(value)
  if (!id) throw new AppError(message, 'VALIDATION')
  return id
}

const nullableUuid = (value: unknown, message: string): string | null =>
  value === undefined || value === null ? null : requireUuid(value, message)

const requireIso = (value: unknown, message: string): string => {
  if (typeof value !== 'string' || !value.trim() || Number.isNaN(Date.parse(value))) throw new AppError(message, 'VALIDATION')
  return value
}

const nullableIso = (value: unknown, message: string): string | null =>
  value === undefined || value === null ? null : requireIso(value, message)

const requireFinite = (value: unknown, message: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new AppError(message, 'VALIDATION')
  return value
}

const nullableFinite = (value: unknown, message: string): number | null =>
  value === undefined || value === null ? null : requireFinite(value, message)

const requireNonNegative = (value: unknown, message: string): number => {
  const result = requireFinite(value, message)
  if (result < 0) throw new AppError(message, 'VALIDATION')
  return result
}

const nullableNonNegative = (value: unknown, message: string): number | null =>
  value === undefined || value === null ? null : requireNonNegative(value, message)

const requireNonNegativeInt = (value: unknown, message: string): number => {
  const result = Number(value)
  if (!Number.isInteger(result) || result < 0) throw new AppError(message, 'VALIDATION')
  return result
}

const nullableNonNegativeInt = (value: unknown, message: string): number | null =>
  value === undefined || value === null ? null : requireNonNegativeInt(value, message)

const requireCoordinate = (latitude: unknown, longitude: unknown, message: string): { latitude: number; longitude: number } => {
  const lat = requireFinite(latitude, message)
  const lng = requireFinite(longitude, message)
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new AppError(message, 'VALIDATION')
  return { latitude: lat, longitude: lng }
}

const requireArray = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) throw new AppError('导入文件结构不正确', 'VALIDATION')
  return value
}

const requireText = (value: unknown, maxLength: number, message: string): string => {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text || text.length > maxLength) throw new AppError(message, 'VALIDATION')
  return text
}

/** Sanitizes tasks for v1 and v2 alike: only whitelisted fields survive, ids only when present. */
const sanitizeTasks = (value: unknown): ExportTask[] => requireArray(value).map((item) => {
  if (!isObject(item)) throw new AppError('任务数据格式不正确', 'VALIDATION')
  const title = typeof item.title === 'string' ? item.title.trim() : ''
  const sortOrder = Number(item.sortOrder)
  if (!title || title.length > 100 || !Number.isInteger(sortOrder) || sortOrder < 0) throw new AppError('任务数据格式不正确', 'VALIDATION')
  const task: ExportTask = { planDate: assertDateKey(item.planDate), title, completed: Boolean(item.completed), sortOrder }
  if (item.estimatedMinutes !== undefined && item.estimatedMinutes !== null) {
    const estimatedMinutes = Number(item.estimatedMinutes)
    if (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 1 || estimatedMinutes > 1440) throw new AppError('任务预计时长格式不正确', 'VALIDATION')
    task.estimatedMinutes = estimatedMinutes
  } else task.estimatedMinutes = null
  if (item.id !== undefined) task.id = requireUuid(item.id, '任务数据格式不正确')
  return task
})

const sanitizePlanDays = (value: unknown): ExportPlanDay[] => requireArray(value).map((item) => {
  if (!isObject(item)) throw new AppError('日期设置格式不正确', 'VALIDATION')
  const note = typeof item.note === 'string' ? item.note : ''
  if (note.length > 1000) throw new AppError('导入备注过长', 'VALIDATION')
  return { planDate: assertDateKey(item.planDate), isRestDay: Boolean(item.isRestDay), note }
})

// ---------------------------------------------------------------------------
// Version 2 study tables. Exported so importPlan reuses the exact same
// sanitizers on the write path (a file can reach importPlan without preview).
// ---------------------------------------------------------------------------

export const parseExportStudyLocations = (value: unknown): ExportStudyLocation[] => requireArray(value).map((item) => {
  const message = '学习地点数据格式不正确'
  if (!isObject(item)) throw new AppError(message, 'VALIDATION')
  const name = typeof item.name === 'string' ? item.name.trim() : ''
  const radiusM = Number(item.radiusM)
  if (!name || name.length > 50 || !Number.isInteger(radiusM) || radiusM < LOCATION_LIMITS.radiusMinM || radiusM > LOCATION_LIMITS.radiusMaxM) throw new AppError(message, 'VALIDATION')
  const { latitude, longitude } = requireCoordinate(item.latitude, item.longitude, message)
  return { id: requireUuid(item.id, message), name, latitude, longitude, radiusM, isActive: Boolean(item.isActive), isDefault: Boolean(item.isDefault) }
})

export const parseExportAttendanceRecords = (value: unknown): ExportAttendanceRecord[] => requireArray(value).map((item) => {
  const message = '签到记录数据格式不正确'
  if (!isObject(item)) throw new AppError(message, 'VALIDATION')
  const checkIn = requireCoordinate(item.checkInLatitude, item.checkInLongitude, message)
  return {
    id: requireUuid(item.id, message),
    locationId: requireUuid(item.locationId, message),
    checkInAt: requireIso(item.checkInAt, message),
    checkInLatitude: checkIn.latitude,
    checkInLongitude: checkIn.longitude,
    checkInAccuracyM: requireNonNegative(item.checkInAccuracyM, message),
    checkInDistanceM: requireNonNegative(item.checkInDistanceM, message),
    checkOutAt: nullableIso(item.checkOutAt, message),
    checkOutLatitude: nullableFinite(item.checkOutLatitude, message),
    checkOutLongitude: nullableFinite(item.checkOutLongitude, message),
    checkOutAccuracyM: nullableNonNegative(item.checkOutAccuracyM, message),
    checkOutDistanceM: nullableNonNegative(item.checkOutDistanceM, message),
    manualClosed: Boolean(item.manualClosed),
  }
})

const isSessionStatus = (value: unknown): value is StudySessionStatus =>
  value === 'running' || value === 'paused' || value === 'waiting' || value === 'completed' || value === 'cancelled'

export const parseExportStudySessions = (value: unknown): ExportStudySession[] => requireArray(value).map((item) => {
  const message = '学习会话数据格式不正确'
  if (!isObject(item) || (item.mode !== 'free' && item.mode !== 'pomodoro') || !isSessionStatus(item.status)) throw new AppError(message, 'VALIDATION')
  if (item.currentPhase !== undefined && item.currentPhase !== null && item.currentPhase !== 'focus' && item.currentPhase !== 'short_break' && item.currentPhase !== 'long_break') throw new AppError(message, 'VALIDATION')
  if (typeof item.taskTitleSnapshot !== 'string') throw new AppError(message, 'VALIDATION')
  const reflection = typeof item.reflection === 'string' ? item.reflection.trim() : ''
  if (reflection.length > 500) throw new AppError('学习记录不能超过 500 个字符', 'VALIDATION')
  return {
    id: requireUuid(item.id, message),
    taskId: nullableUuid(item.taskId, message),
    taskTitleSnapshot: item.taskTitleSnapshot,
    attendanceRecordId: nullableUuid(item.attendanceRecordId, message),
    planDate: assertDateKey(item.planDate),
    mode: item.mode as StudyMode,
    status: item.status,
    startedAt: requireIso(item.startedAt, message),
    endedAt: nullableIso(item.endedAt, message),
    pomodoroFocusSeconds: nullableNonNegativeInt(item.pomodoroFocusSeconds, message),
    pomodoroShortBreakSeconds: nullableNonNegativeInt(item.pomodoroShortBreakSeconds, message),
    pomodoroLongBreakSeconds: nullableNonNegativeInt(item.pomodoroLongBreakSeconds, message),
    pomodoroRoundsBeforeLongBreak: nullableNonNegativeInt(item.pomodoroRoundsBeforeLongBreak, message),
    pomodoroCompletedRounds: requireNonNegativeInt(item.pomodoroCompletedRounds, message),
    currentPhase: (item.currentPhase ?? null) as PomodoroPhase | null,
    currentRound: requireNonNegativeInt(item.currentRound, message),
    phaseStartedAt: nullableIso(item.phaseStartedAt, message),
    phaseEndsAt: nullableIso(item.phaseEndsAt, message),
    phaseRemainingSeconds: nullableNonNegativeInt(item.phaseRemainingSeconds, message),
    reflection,
  }
})

export const parseExportStudySessionSegments = (value: unknown): ExportStudySessionSegment[] => requireArray(value).map((item) => {
  const message = '计时片段数据格式不正确'
  if (!isObject(item) || (item.segmentKind !== 'free' && item.segmentKind !== 'focus')) throw new AppError(message, 'VALIDATION')
  const pomodoroRound = nullableNonNegativeInt(item.pomodoroRound, message)
  const pomodoroCompletedAt = nullableIso(item.pomodoroCompletedAt, message)
  const endedAt = nullableIso(item.endedAt, message)
  if (pomodoroRound === 0 || (pomodoroCompletedAt && (item.segmentKind !== 'focus' || !pomodoroRound || !endedAt))) {
    throw new AppError(message, 'VALIDATION')
  }
  return {
    id: requireUuid(item.id, message),
    sessionId: requireUuid(item.sessionId, message),
    segmentKind: item.segmentKind as SegmentKind,
    pomodoroRound,
    pomodoroCompletedAt,
    startedAt: requireIso(item.startedAt, message),
    endedAt,
  }
})

const requirePreferenceInt = (value: unknown, limit: { min: number; max: number }): number => {
  const result = Number(value)
  if (!Number.isInteger(result) || result < limit.min || result > limit.max) throw new AppError('学习偏好数据格式不正确', 'VALIDATION')
  return result
}

export const parseExportStudyPreferences = (value: unknown): ExportStudyPreferences | null => {
  if (value === undefined || value === null) return null
  const message = '学习偏好数据格式不正确'
  if (!isObject(value) || (value.defaultMode !== 'free' && value.defaultMode !== 'pomodoro')) throw new AppError(message, 'VALIDATION')
  const countdownEnabled = value.countdownEnabled === undefined ? false : Boolean(value.countdownEnabled)
  const countdownDate = value.countdownDate === undefined || value.countdownDate === null ? null : assertDateKey(value.countdownDate, '倒计时日期')
  if (countdownEnabled && !countdownDate) throw new AppError('开启倒计时前请选择目标日期', 'VALIDATION')
  return {
    defaultMode: value.defaultMode as StudyMode,
    focusSeconds: requirePreferenceInt(value.focusSeconds, POMODORO_LIMITS.focusSeconds),
    shortBreakSeconds: requirePreferenceInt(value.shortBreakSeconds, POMODORO_LIMITS.shortBreakSeconds),
    longBreakSeconds: requirePreferenceInt(value.longBreakSeconds, POMODORO_LIMITS.longBreakSeconds),
    roundsBeforeLongBreak: requirePreferenceInt(value.roundsBeforeLongBreak, POMODORO_LIMITS.roundsBeforeLongBreak),
    soundEnabled: Boolean(value.soundEnabled),
    vibrationEnabled: Boolean(value.vibrationEnabled),
    dailyGoalEnabled: value.dailyGoalEnabled === undefined ? true : Boolean(value.dailyGoalEnabled),
    dailyGoalMinutes: value.dailyGoalMinutes === undefined ? 120 : requirePreferenceInt(value.dailyGoalMinutes, { min: 1, max: 1440 }),
    countdownEnabled,
    countdownTitle: value.countdownTitle === undefined ? '考研初试' : requireText(value.countdownTitle, 30, message),
    countdownDate,
  }
}

// ---------------------------------------------------------------------------
// Import validation: accepts version 1 (legacy plan exports) and version 2
// (full backups). Only whitelisted fields survive; everything else is dropped.
// ---------------------------------------------------------------------------

export function validateImportData(input: string): StudyBloomExport {
  let raw: unknown
  try { raw = JSON.parse(input) } catch { throw new AppError('导入文件不是有效的 JSON', 'VALIDATION') }
  if (!isObject(raw)) throw new AppError('导入文件结构不正确', 'VALIDATION')
  const exportedAt = typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString()
  if (raw.version === 2) {
    return {
      version: 2,
      exportedAt,
      tasks: sanitizeTasks(raw.tasks),
      planDays: sanitizePlanDays(raw.planDays),
      studyLocations: parseExportStudyLocations(raw.studyLocations),
      attendanceRecords: parseExportAttendanceRecords(raw.attendanceRecords),
      studySessions: parseExportStudySessions(raw.studySessions),
      studySessionSegments: parseExportStudySessionSegments(raw.studySessionSegments),
      studyPreferences: parseExportStudyPreferences(raw.studyPreferences),
    }
  }
  if (raw.version !== 1) throw new AppError(raw.version === undefined ? '导入文件结构不正确' : '不支持的导入文件版本', 'VALIDATION')
  return { version: 1, exportedAt, tasks: sanitizeTasks(raw.tasks), planDays: sanitizePlanDays(raw.planDays) }
}

/** Full backup (version 2): plan data plus the complete study module, coordinates included. */
export async function exportAllDataJson(): Promise<string> {
  const user = await requireUser()
  try {
    const client = getSupabase()
    const [taskRes, dayRes, locationRes, attendanceRes, sessionRes, segmentRes, preferenceRes] = await Promise.all([
      client.from('tasks').select('*').eq('user_id', user.id).order('plan_date').order('sort_order'),
      client.from('plan_days').select('*').eq('user_id', user.id).order('plan_date'),
      client.from('study_locations').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at'),
      client.from('attendance_records').select('*').eq('user_id', user.id).order('check_in_at'),
      client.from('study_sessions').select('*').eq('user_id', user.id).order('started_at'),
      client.from('study_session_segments').select('*').eq('user_id', user.id).order('started_at'),
      client.from('study_preferences').select('*').eq('user_id', user.id).maybeSingle(),
    ])
    for (const result of [taskRes, dayRes, locationRes, attendanceRes, sessionRes, segmentRes, preferenceRes]) {
      if (result.error) throw result.error
    }
    const preferenceRow = preferenceRes.data as PreferencesRow | null
    const payload: StudyBloomExportV2 = {
      version: 2,
      exportedAt: new Date().toISOString(),
      tasks: (taskRes.data as TaskRow[]).map((row) => ({ id: row.id, planDate: row.plan_date, title: row.title, completed: row.completed, sortOrder: row.sort_order, estimatedMinutes: row.estimated_minutes })),
      planDays: (dayRes.data as PlanDayRow[]).map((row) => ({ planDate: row.plan_date, isRestDay: row.is_rest_day, note: row.note ?? '' })),
      studyLocations: (locationRes.data as LocationRow[]).map((row) => ({ id: row.id, name: row.name, latitude: row.latitude, longitude: row.longitude, radiusM: row.radius_m, isActive: row.is_active, isDefault: row.is_default })),
      attendanceRecords: (attendanceRes.data as AttendanceRow[]).map((row) => ({
        id: row.id,
        locationId: row.location_id,
        checkInAt: row.check_in_at,
        checkInLatitude: row.check_in_latitude,
        checkInLongitude: row.check_in_longitude,
        checkInAccuracyM: row.check_in_accuracy_m,
        checkInDistanceM: row.check_in_distance_m,
        checkOutAt: row.check_out_at,
        checkOutLatitude: row.check_out_latitude,
        checkOutLongitude: row.check_out_longitude,
        checkOutAccuracyM: row.check_out_accuracy_m,
        checkOutDistanceM: row.check_out_distance_m,
        manualClosed: row.manual_closed,
      })),
      studySessions: (sessionRes.data as SessionRow[]).map((row) => ({
        id: row.id,
        taskId: row.task_id,
        taskTitleSnapshot: row.task_title_snapshot,
        attendanceRecordId: row.attendance_record_id,
        planDate: row.plan_date,
        mode: row.mode,
        status: row.status,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        pomodoroFocusSeconds: row.pomodoro_focus_seconds,
        pomodoroShortBreakSeconds: row.pomodoro_short_break_seconds,
        pomodoroLongBreakSeconds: row.pomodoro_long_break_seconds,
        pomodoroRoundsBeforeLongBreak: row.pomodoro_rounds_before_long_break,
        pomodoroCompletedRounds: row.pomodoro_completed_rounds,
        currentPhase: row.current_phase,
        currentRound: row.current_round,
        phaseStartedAt: row.phase_started_at,
        phaseEndsAt: row.phase_ends_at,
        phaseRemainingSeconds: row.phase_remaining_seconds,
        reflection: row.reflection,
      })),
      studySessionSegments: (segmentRes.data as SegmentRow[]).map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        segmentKind: row.segment_kind,
        pomodoroRound: row.pomodoro_round,
        pomodoroCompletedAt: row.pomodoro_completed_at,
        startedAt: row.started_at,
        endedAt: row.ended_at,
      })),
      studyPreferences: preferenceRow ? {
        defaultMode: preferenceRow.default_mode,
        focusSeconds: preferenceRow.focus_seconds,
        shortBreakSeconds: preferenceRow.short_break_seconds,
        longBreakSeconds: preferenceRow.long_break_seconds,
        roundsBeforeLongBreak: preferenceRow.rounds_before_long_break,
        soundEnabled: preferenceRow.sound_enabled,
        vibrationEnabled: preferenceRow.vibration_enabled,
        dailyGoalEnabled: preferenceRow.daily_goal_enabled,
        dailyGoalMinutes: preferenceRow.daily_goal_minutes,
        countdownEnabled: preferenceRow.countdown_enabled,
        countdownTitle: preferenceRow.countdown_title,
        countdownDate: preferenceRow.countdown_date,
      } : null,
    }
    return JSON.stringify(payload, null, 2)
  } catch (error) {
    throw toAppError(error, '导出数据失败')
  }
}
