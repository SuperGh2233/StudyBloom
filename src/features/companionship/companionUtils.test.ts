import { describe, expect, it } from 'vitest'
import { companionWeeklyText, sharedBloomDates, sharedBloomDatesWithConsent } from './companionUtils'

const day = (date: string, effectiveStudy: boolean) => ({ date, effectiveStudy, studiedMinutes: null, completedTasks: null, totalTasks: null })

describe('一起绽放计算', () => {
  it('只保留双方都有有效学习的日期', () => {
    expect([...sharedBloomDates([day('2026-08-10', true), day('2026-08-11', true)], [day('2026-08-10', false), day('2026-08-11', true)])]).toEqual(['2026-08-11'])
  })

  it('任一方未授权时不生成共同绽放', () => {
    const own = [day('2026-08-11', true)]
    const companion = [day('2026-08-11', true)]
    expect([...sharedBloomDatesWithConsent('none', 'bloom_only', own, companion)]).toEqual([])
    expect([...sharedBloomDatesWithConsent('summary', 'none', own, companion)]).toEqual([])
    expect([...sharedBloomDatesWithConsent('bloom_only', 'summary', own, companion)]).toEqual(['2026-08-11'])
  })

  it('周记不比较双方学习量', () => {
    expect(companionWeeklyText(4, 8)).toContain('你们有 4 天')
    expect(companionWeeklyText(0, 3)).not.toMatch(/落后|超过|更多/)
  })
})
