import { startOfMonth, startOfWeek, subDays } from 'date-fns'
import type { DateKey, DateRange, StudyDailyPoint, StudyTimeStatistics } from '../types'
import { formatDateKey, todayDateKey } from '../utils/date'
import { calculateStudyStatistics } from '../utils/studyDuration'
import { fetchStudyDataForRange } from './studySessions'

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
  const fetchStart = range.startDate < chartStart ? range.startDate : chartStart
  const { sessions, segments } = await fetchStudyDataForRange(fetchStart, range.endDate)
  return {
    metrics: calculateStudyStatistics(sessions, segments, range),
    lastSevenDays: calculateStudyStatistics(sessions, segments, { startDate: chartStart, endDate: range.endDate }).byDay,
  }
}
