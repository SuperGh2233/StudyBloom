import type { CompanionDaySummary, CompanionShareLevel, CompanionWeeklySummary, DateKey } from '../../types'
import { addDays } from '../../utils/date'

export const EFFECTIVE_STUDY_SECONDS = 10 * 60

export function sharedBloomDates(ownDays: CompanionDaySummary[], companionDays: CompanionDaySummary[]): Set<DateKey> {
  const own = new Set(ownDays.filter((day) => day.effectiveStudy).map((day) => day.date))
  return new Set(companionDays.filter((day) => day.effectiveStudy && own.has(day.date)).map((day) => day.date))
}

export function sharedBloomDatesWithConsent(
  ownLevel: CompanionShareLevel,
  companionLevel: CompanionShareLevel,
  ownDays: CompanionDaySummary[],
  companionDays: CompanionDaySummary[],
): Set<DateKey> {
  if (ownLevel === 'none' || companionLevel === 'none') return new Set()
  return sharedBloomDates(ownDays, companionDays)
}

/** 连续共同绽放天数：今天已绽放则从今天起数，否则从昨天起数（今天仍有机会延续记录）。 */
export function sharedBloomStreak(dates: Iterable<DateKey>, today: DateKey): number {
  const set = dates instanceof Set ? dates : new Set(dates)
  let cursor = set.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (set.has(cursor)) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function companionWeeklyText(weekBloomDays: number, totalBloomDays: number): string {
  if (weekBloomDays >= 4) return `这一周，你们有 ${weekBloomDays} 天都为自己的目标留出了时间。`
  if (weekBloomDays > 0) return '不必同时出发，你们仍然在一起前进。'
  if (totalBloomDays > 0) return '这一周节奏比较轻，休息也是长期坚持的一部分。'
  return '第一朵共同的花，会从各自认真生活的一天开始。'
}

export function withWeeklyText(summary: Omit<CompanionWeeklySummary, 'summary'>): CompanionWeeklySummary {
  return { ...summary, summary: companionWeeklyText(summary.weekBloomDays, summary.totalBloomDays) }
}
