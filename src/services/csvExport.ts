import { getSupabase } from '../lib/supabase'
import type { Database } from '../types'
import { formatDateKey, todayDateKey } from '../utils/date'
import { calculateStudyStatistics, sessionElapsedSeconds } from '../utils/studyDuration'
import { mapAttendanceRecord, mapStudyLocation } from './attendance'
import { requireUser } from './auth'
import { getStudyPreferences, mapStudySegment, mapStudySession } from './studySessions'
import { toAppError } from '../utils/errorMessage'

type SessionRow = Database['public']['Tables']['study_sessions']['Row']
type SegmentRow = Database['public']['Tables']['study_session_segments']['Row']
type AttendanceRow = Database['public']['Tables']['attendance_records']['Row']
type LocationRow = Database['public']['Tables']['study_locations']['Row']

export const toCsv = (rows: (string | number | null)[][]) => `\ufeff${rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n')}`
const minutes = (seconds: number) => Math.round((seconds / 60) * 10) / 10

async function fetchExportRows() {
  const user = await requireUser()
  try {
    const client = getSupabase()
    const [sessionResult, segmentResult, attendanceResult, locationResult, preferences] = await Promise.all([
      client.from('study_sessions').select('*').eq('user_id', user.id).order('started_at'),
      client.from('study_session_segments').select('*').eq('user_id', user.id).order('started_at'),
      client.from('attendance_records').select('*').eq('user_id', user.id).order('check_in_at'),
      client.from('study_locations').select('*').eq('user_id', user.id),
      getStudyPreferences(),
    ])
    for (const result of [sessionResult, segmentResult, attendanceResult, locationResult]) if (result.error) throw result.error
    return {
      sessions: (sessionResult.data as SessionRow[]).map(mapStudySession),
      segments: (segmentResult.data as SegmentRow[]).map(mapStudySegment),
      attendance: (attendanceResult.data as AttendanceRow[]).map(mapAttendanceRecord),
      locations: (locationResult.data as LocationRow[]).map(mapStudyLocation),
      preferences,
    }
  } catch (error) { throw toAppError(error, '读取导出数据失败') }
}

export async function exportStudySessionsCsv() {
  const { sessions, segments } = await fetchExportRows()
  return toCsv([
    ['日期', '任务', '学习模式', '开始时间', '结束时间', '学习时长（分钟）', '番茄轮数', '学习感受'],
    ...sessions.map((session) => [
      session.planDate,
      session.taskTitleSnapshot || '自由学习',
      session.mode === 'pomodoro' ? '番茄专注' : '自由学习',
      session.startedAt,
      session.endedAt,
      minutes(sessionElapsedSeconds(session, segments)),
      session.pomodoroCompletedRounds,
      session.reflection,
    ]),
  ])
}

export async function exportDailyStudyCsv() {
  const { sessions, segments, preferences } = await fetchExportRows()
  const endDate = todayDateKey()
  const startDate = segments.length ? segments.map((segment) => formatDateKey(Date.parse(segment.startedAt))).sort()[0] : endDate
  const stats = calculateStudyStatistics(sessions, segments, { startDate, endDate })
  const goalEnabled = preferences?.dailyGoalEnabled ?? true
  const goalMinutes = preferences?.dailyGoalMinutes ?? 120
  return toCsv([
    ['日期', '总学习（分钟）', '自由学习（分钟）', '番茄专注（分钟）', '番茄轮数', '目标（分钟）', '目标完成率', '是否达成目标'],
    ...stats.byDay.map((day) => {
      const detail = calculateStudyStatistics(sessions, segments, { startDate: day.date, endDate: day.date })
      const rate = goalEnabled ? Math.round((day.seconds / (goalMinutes * 60)) * 100) : null
      return [day.date, minutes(day.seconds), minutes(detail.freeSeconds), minutes(detail.focusSeconds), day.pomodoroRounds, goalEnabled ? goalMinutes : null, rate === null ? null : `${rate}%`, goalEnabled ? (day.seconds >= goalMinutes * 60 ? '是' : '否') : '未启用']
    }),
  ])
}

export async function exportAttendanceCsv() {
  const { attendance, locations } = await fetchExportRows()
  const names = new Map(locations.map((location) => [location.id, location.name]))
  return toCsv([
    ['地点', '签到时间', '签退时间', '签到距离（米）', '签退距离（米）', '签到结果'],
    ...attendance.map((record) => [
      names.get(record.locationId) ?? '已停用地点',
      record.checkInAt,
      record.checkOutAt,
      Math.round(record.checkInDistanceM),
      record.checkOutDistanceM === null ? null : Math.round(record.checkOutDistanceM),
      record.manualClosed ? '异常结束' : record.checkOutAt ? '正常完成' : '进行中',
    ]),
  ])
}
