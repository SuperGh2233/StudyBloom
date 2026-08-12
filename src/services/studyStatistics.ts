import { startOfMonth, startOfWeek, subDays } from 'date-fns'
import type { DateKey, DateRange, StudyDailyPoint, StudyTimeSlot, StudyTimeStatistics, WeeklyStudyReview } from '../types'
import { formatDateKey, todayDateKey } from '../utils/date'
import { calculateStudyStatistics, calculateStudyTimeSlots } from '../utils/studyDuration'
import { listAttendanceRecordsByRange } from './attendance'
import { fetchStudyDataForRange } from './studySessions'
import { getStudyPreferences } from './studySessions'
import { listTasksByRange } from './tasks'

export type StudyRangeKind = 'today' | 'week' | 'month'

/** Range ending today; weeks start on Monday like the calendar. */
export function studyRangeFor(kind: StudyRangeKind, now: Date = new Date()): DateRange {
  const endDate = todayDateKey(now)
  let startDate: DateKey
  if (kind === 'today') startDate = endDate
  else if (kind === 'week') startDate = formatDateKey(startOfWeek(now, { weekStartsOn: 1 }))
  else startDate = formatDateKey(startOfMonth(now))
  return { startDate, endDate }
}

export interface StudyStatisticsView {
  /** Metrics for the selected range only. */
  metrics: StudyTimeStatistics
  /** Trailing 7 days, independent of the selected range. */
  lastSevenDays: StudyDailyPoint[]
  goalEnabled: boolean
  goalMinutes: number
  goalMetDays: number
  validAttendanceDays: number
  timeSlots: StudyTimeSlot[]
  weeklyReview: WeeklyStudyReview
}

export const countGoalMetDays = (days: StudyDailyPoint[], goalMinutes: number) => days.filter((day) => day.seconds >= goalMinutes * 60).length

export function weeklySummary(totalSeconds: number, changePercent: number | null, goalMetDays: number, topTaskTitle: string | null) {
  if (totalSeconds === 0) return '这一周还没有学习记录，给下一次开始留一点轻松的空间。'
  const focus = topTaskTitle ? `你在「${topTaskTitle}」上投入最多。` : ''
  if (goalMetDays >= 5) return `这周的节奏很稳定，已有 ${goalMetDays} 天完成目标。${focus}`
  if (changePercent !== null && changePercent >= 10) return `比上周多投入了一些时间，积累正在慢慢变得清晰。${focus}`
  if (changePercent !== null && changePercent <= -10) return `这周稍微放慢了一点也没关系，找到舒服的节奏更重要。${focus}`
  return `这周保持了平稳的学习节奏，每一次坐下来都算数。${focus}`
}

/**
 * One fetch over the union of the selected range and the trailing 7 days,
 * then two pure calculations: metric cards follow the selected range while
 * the "last 7 days" chart always covers a full week.
 */
export async function getStudyTimeStatistics(kind: StudyRangeKind): Promise<StudyStatisticsView> {
  const now = new Date()
  const range = studyRangeFor(kind, now)
  const chartStart = formatDateKey(subDays(now, 6))
  const weekStart = formatDateKey(startOfWeek(now, { weekStartsOn: 1 }))
  const previousWeekStart = formatDateKey(subDays(startOfWeek(now, { weekStartsOn: 1 }), 7))
  const previousWeekEnd = formatDateKey(subDays(startOfWeek(now, { weekStartsOn: 1 }), 1))
  const fetchStart = [range.startDate, chartStart, previousWeekStart].sort()[0]
  const [{ sessions, segments }, attendance, preferences, weekTasks] = await Promise.all([
    fetchStudyDataForRange(fetchStart, range.endDate),
    listAttendanceRecordsByRange(range.startDate, range.endDate),
    getStudyPreferences(),
    listTasksByRange(weekStart, range.endDate),
  ])
  const goalEnabled = preferences?.dailyGoalEnabled ?? true
  const goalMinutes = preferences?.dailyGoalMinutes ?? 120
  const metrics = calculateStudyStatistics(sessions, segments, range)
  const weekMetrics = calculateStudyStatistics(sessions, segments, { startDate: weekStart, endDate: range.endDate })
  const previousWeekMetrics = calculateStudyStatistics(sessions, segments, { startDate: previousWeekStart, endDate: previousWeekEnd })
  const changePercent = previousWeekMetrics.totalSeconds > 0
    ? Math.round(((weekMetrics.totalSeconds - previousWeekMetrics.totalSeconds) / previousWeekMetrics.totalSeconds) * 100)
    : weekMetrics.totalSeconds > 0 ? null : 0
  const weekGoalMetDays = goalEnabled ? countGoalMetDays(weekMetrics.byDay, goalMinutes) : 0
  const topTaskTitle = weekMetrics.byTask[0]?.taskTitle ?? null
  return {
    metrics,
    lastSevenDays: calculateStudyStatistics(sessions, segments, { startDate: chartStart, endDate: range.endDate }).byDay,
    goalEnabled,
    goalMinutes,
    goalMetDays: goalEnabled ? countGoalMetDays(metrics.byDay, goalMinutes) : 0,
    validAttendanceDays: new Set(attendance.filter((record) => !record.manualClosed).map((record) => formatDateKey(Date.parse(record.checkInAt)))).size,
    timeSlots: calculateStudyTimeSlots(sessions, segments, range),
    weeklyReview: {
      startDate: weekStart,
      endDate: range.endDate,
      totalSeconds: weekMetrics.totalSeconds,
      previousWeekSeconds: previousWeekMetrics.totalSeconds,
      changePercent,
      topTaskTitle,
      completedTaskCount: weekTasks.filter((task) => task.completed).length,
      goalMetDays: weekGoalMetDays,
      summary: weeklySummary(weekMetrics.totalSeconds, changePercent, weekGoalMetDays, topTaskTitle),
    },
  }
}
