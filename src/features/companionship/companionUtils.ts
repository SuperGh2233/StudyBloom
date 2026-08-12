import type { CompanionDaySummary, CompanionShareLevel, CompanionWeeklySummary, DateKey } from '../../types'

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

export function companionWeeklyText(weekBloomDays: number, totalBloomDays: number): string {
  if (weekBloomDays >= 4) return `这一周，你们有 ${weekBloomDays} 天都为自己的目标留出了时间。`
  if (weekBloomDays > 0) return '不必同时出发，你们仍然在一起前进。'
  if (totalBloomDays > 0) return '这一周节奏比较轻，休息也是长期坚持的一部分。'
  return '第一朵共同的花，会从各自认真生活的一天开始。'
}

export function withWeeklyText(summary: Omit<CompanionWeeklySummary, 'summary'>): CompanionWeeklySummary {
  return { ...summary, summary: companionWeeklyText(summary.weekBloomDays, summary.totalBloomDays) }
}
