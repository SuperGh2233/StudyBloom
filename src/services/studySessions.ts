import { getSupabase } from '../lib/supabase'
import { requireUser } from './auth'
import type { Database, DateKey, PomodoroPhase, StudyMode, StudyPreferences, StudyPreferencesUpdate, StudySession, StudySessionSegment } from '../types'
import { POMODORO_LIMITS } from '../types'
import { assertDateKey } from '../utils/date'
import { AppError, toAppError } from '../utils/errorMessage'

type SessionRow = Database['public']['Tables']['study_sessions']['Row']
type SegmentRow = Database['public']['Tables']['study_session_segments']['Row']
type PreferencesRow = Database['public']['Tables']['study_preferences']['Row']

export const mapStudySession = (row: SessionRow): StudySession => ({
  id: row.id,
  userId: row.user_id,
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
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const mapStudySegment = (row: SegmentRow): StudySessionSegment => ({
  id: row.id,
  userId: row.user_id,
  sessionId: row.session_id,
  segmentKind: row.segment_kind,
  pomodoroRound: row.pomodoro_round,
  pomodoroCompletedAt: row.pomodoro_completed_at,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  createdAt: row.created_at,
})

export const mapStudyPreferences = (row: PreferencesRow): StudyPreferences => ({
  userId: row.user_id,
  defaultMode: row.default_mode,
  focusSeconds: row.focus_seconds,
  shortBreakSeconds: row.short_break_seconds,
  longBreakSeconds: row.long_break_seconds,
  roundsBeforeLongBreak: row.rounds_before_long_break,
  soundEnabled: row.sound_enabled,
  vibrationEnabled: row.vibration_enabled,
  dailyGoalEnabled: row.daily_goal_enabled,
  dailyGoalMinutes: row.daily_goal_minutes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const defaultStudyPreferences = (userId: string): StudyPreferences => ({
  userId,
  defaultMode: 'free',
  focusSeconds: POMODORO_LIMITS.focusSeconds.fallback,
  shortBreakSeconds: POMODORO_LIMITS.shortBreakSeconds.fallback,
  longBreakSeconds: POMODORO_LIMITS.longBreakSeconds.fallback,
  roundsBeforeLongBreak: POMODORO_LIMITS.roundsBeforeLongBreak.fallback,
  soundEnabled: false,
  vibrationEnabled: true,
  dailyGoalEnabled: true,
  dailyGoalMinutes: 120,
  createdAt: '',
  updatedAt: '',
})

const assertSessionId = (id: string) => {
  if (!id.trim()) throw new AppError('学习会话 ID 不能为空', 'VALIDATION')
}

async function rpcSession(name: 'pause_study_session' | 'resume_study_session' | 'sync_pomodoro_session' | 'skip_pomodoro_break' | 'end_current_focus_round' | 'finish_study_session', sessionId: string, fallback: string): Promise<StudySession> {
  assertSessionId(sessionId)
  await requireUser()
  try {
    const { data, error } = await getSupabase().rpc(name, { p_session_id: sessionId })
    if (error) throw error
    if (!data) throw new AppError('学习会话不存在', 'NOT_FOUND')
    return mapStudySession(data)
  } catch (error) { throw toAppError(error, fallback) }
}

export interface StartSessionInput {
  mode: StudyMode
  taskId?: string | null
  focusSeconds?: number
  shortBreakSeconds?: number
  longBreakSeconds?: number
  roundsBeforeLongBreak?: number
}

export async function startStudySession(input: StartSessionInput): Promise<StudySession> {
  if (input.mode !== 'free' && input.mode !== 'pomodoro') throw new AppError('学习模式参数不正确', 'VALIDATION')
  await requireUser()
  try {
    const { data, error } = await getSupabase().rpc('start_study_session', {
      p_mode: input.mode,
      p_task_id: input.taskId ?? null,
      p_focus_seconds: input.mode === 'pomodoro' ? input.focusSeconds ?? null : null,
      p_short_break_seconds: input.mode === 'pomodoro' ? input.shortBreakSeconds ?? null : null,
      p_long_break_seconds: input.mode === 'pomodoro' ? input.longBreakSeconds ?? null : null,
      p_rounds_before_long_break: input.mode === 'pomodoro' ? input.roundsBeforeLongBreak ?? null : null,
    })
    if (error) throw error
    return mapStudySession(data)
  } catch (error) { throw toAppError(error, '开启学习失败') }
}

export const pauseStudySession = (sessionId: string) => rpcSession('pause_study_session', sessionId, '暂停学习失败')
export const resumeStudySession = (sessionId: string) => rpcSession('resume_study_session', sessionId, '继续学习失败')
export const skipPomodoroBreak = (sessionId: string) => rpcSession('skip_pomodoro_break', sessionId, '跳过休息失败')
export const endCurrentFocusRound = (sessionId: string) => rpcSession('end_current_focus_round', sessionId, '提前结束本轮失败')
export const finishStudySession = (sessionId: string) => rpcSession('finish_study_session', sessionId, '结束学习失败')

export async function saveStudySessionReflection(sessionId: string, reflection: string): Promise<StudySession> {
  assertSessionId(sessionId)
  if (reflection.trim().length > 500) throw new AppError('学习记录不能超过 500 个字符', 'VALIDATION')
  await requireUser()
  try {
    const { data, error } = await getSupabase().rpc('save_study_session_reflection', { p_session_id: sessionId, p_reflection: reflection })
    if (error) throw error
    return mapStudySession(data)
  } catch (error) { throw toAppError(error, '保存学习记录失败') }
}

/**
 * Idempotent catch-up: closes any phase whose planned end time passed while
 * the page was closed/backgrounded, then returns the fresh session state.
 */
export const syncPomodoroSession = (sessionId: string) => rpcSession('sync_pomodoro_session', sessionId, '同步学习状态失败')

export async function startNextPomodoroPhase(sessionId: string, phase: PomodoroPhase): Promise<StudySession> {
  assertSessionId(sessionId)
  await requireUser()
  try {
    const { data, error } = await getSupabase().rpc('start_next_pomodoro_phase', { p_session_id: sessionId, p_phase: phase })
    if (error) throw error
    return mapStudySession(data)
  } catch (error) { throw toAppError(error, '开始下一阶段失败') }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * The user's single active session, already synced against expired phases.
 * caughtUpFocus is true when the sync just closed a focus phase that expired
 * while the page was away (reopen/background), so the UI can still show the
 * 「本轮专注已完成」 notification it missed in real time.
 */
export async function getActiveStudySession(): Promise<{ session: StudySession | null; caughtUpFocus: boolean }> {
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase()
      .from('study_sessions')
      .select('*')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data) return { session: null, caughtUpFocus: false }
    if (data.mode === 'pomodoro' && data.status === 'running') {
      const session = await syncPomodoroSession(data.id)
      const caughtUpFocus = data.current_phase === 'focus' && session.status === 'waiting'
      return { session, caughtUpFocus }
    }
    return { session: mapStudySession(data), caughtUpFocus: false }
  } catch (error) { throw toAppError(error, '读取学习会话失败') }
}

export async function listSessionSegments(sessionId: string): Promise<StudySessionSegment[]> {
  assertSessionId(sessionId)
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase()
      .from('study_session_segments')
      .select('*')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .order('started_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map(mapStudySegment)
  } catch (error) { throw toAppError(error, '读取计时片段失败') }
}

/**
 * Sessions overlapping the range: started within it (plan_date is the local
 * start date) or still running / ended after the range start. This keeps
 * cross-midnight sessions so their next-day segment time stays countable.
 */
export async function listStudySessionsByDateRange(startDate: DateKey, endDate: DateKey): Promise<StudySession[]> {
  assertDateKey(startDate)
  assertDateKey(endDate)
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase()
      .from('study_sessions')
      .select('*')
      .eq('user_id', user.id)
      .lte('plan_date', endDate)
      .or(`ended_at.is.null,ended_at.gte.${startDate}T00:00:00+08:00`)
      .order('started_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(mapStudySession)
  } catch (error) { throw toAppError(error, '读取学习记录失败') }
}

export async function listSegmentsForSessions(sessionIds: string[]): Promise<StudySessionSegment[]> {
  const unique = [...new Set(sessionIds.filter(Boolean))]
  if (!unique.length) return []
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase()
      .from('study_session_segments')
      .select('*')
      .eq('user_id', user.id)
      .in('session_id', unique)
      .order('started_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map(mapStudySegment)
  } catch (error) { throw toAppError(error, '读取计时片段失败') }
}

/** Sessions + segments for statistics over a range (two plain RLS reads). */
export async function fetchStudyDataForRange(startDate: DateKey, endDate: DateKey): Promise<{ sessions: StudySession[]; segments: StudySessionSegment[] }> {
  const sessions = await listStudySessionsByDateRange(startDate, endDate)
  const segments = await listSegmentsForSessions(sessions.map((session) => session.id))
  return { sessions, segments }
}

/** All study history linked to the supplied tasks; shared by calendar progress and task details. */
export async function fetchStudyDataForTasks(taskIds: string[]): Promise<{ sessions: StudySession[]; segments: StudySessionSegment[] }> {
  const ids = [...new Set(taskIds.filter(Boolean))]
  if (!ids.length) return { sessions: [], segments: [] }
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase()
      .from('study_sessions')
      .select('*')
      .eq('user_id', user.id)
      .in('task_id', ids)
      .order('started_at', { ascending: false })
    if (error) throw error
    const sessions = (data ?? []).map(mapStudySession)
    return { sessions, segments: await listSegmentsForSessions(sessions.map((session) => session.id)) }
  } catch (error) { throw toAppError(error, '读取任务学习记录失败') }
}

// ---------------------------------------------------------------------------
// Preferences (cross-device pomodoro settings)
// ---------------------------------------------------------------------------

export async function getStudyPreferences(): Promise<StudyPreferences | null> {
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase()
      .from('study_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) throw error
    return data ? mapStudyPreferences(data) : null
  } catch (error) { throw toAppError(error, '读取学习偏好失败') }
}

const assertInRange = (value: number, limit: { min: number; max: number }, label: string) => {
  if (!Number.isInteger(value) || value < limit.min || value > limit.max) {
    throw new AppError(`${label}超出允许范围`, 'VALIDATION')
  }
  return value
}

export async function saveStudyPreferences(update: StudyPreferencesUpdate): Promise<StudyPreferences> {
  const user = await requireUser()
  const patch: Database['public']['Tables']['study_preferences']['Insert'] = { user_id: user.id }
  if (update.defaultMode !== undefined) {
    if (update.defaultMode !== 'free' && update.defaultMode !== 'pomodoro') throw new AppError('默认学习模式不正确', 'VALIDATION')
    patch.default_mode = update.defaultMode
  }
  if (update.focusSeconds !== undefined) patch.focus_seconds = assertInRange(update.focusSeconds, POMODORO_LIMITS.focusSeconds, '专注时长')
  if (update.shortBreakSeconds !== undefined) patch.short_break_seconds = assertInRange(update.shortBreakSeconds, POMODORO_LIMITS.shortBreakSeconds, '短休息时长')
  if (update.longBreakSeconds !== undefined) patch.long_break_seconds = assertInRange(update.longBreakSeconds, POMODORO_LIMITS.longBreakSeconds, '长休息时长')
  if (update.roundsBeforeLongBreak !== undefined) patch.rounds_before_long_break = assertInRange(update.roundsBeforeLongBreak, POMODORO_LIMITS.roundsBeforeLongBreak, '长休息间隔')
  if (update.soundEnabled !== undefined) patch.sound_enabled = Boolean(update.soundEnabled)
  if (update.vibrationEnabled !== undefined) patch.vibration_enabled = Boolean(update.vibrationEnabled)
  if (update.dailyGoalEnabled !== undefined) patch.daily_goal_enabled = Boolean(update.dailyGoalEnabled)
  if (update.dailyGoalMinutes !== undefined) patch.daily_goal_minutes = assertInRange(update.dailyGoalMinutes, { min: 1, max: 1440 }, '每日学习目标')
  if (Object.keys(patch).length <= 1) throw new AppError('没有需要保存的学习偏好', 'VALIDATION')
  try {
    const { data, error } = await getSupabase()
      .from('study_preferences')
      .upsert(patch, { onConflict: 'user_id' })
      .select('*')
      .single()
    if (error) throw error
    return mapStudyPreferences(data)
  } catch (error) { throw toAppError(error, '保存学习偏好失败') }
}
