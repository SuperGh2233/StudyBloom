import { describe, expect, it } from 'vitest'
import { addDays, formatDateKey, monthRange } from './date'

describe('UTC+8 日期工具', () => {
  it('在 UTC+8 深夜正确跨到次日和次月', () => {
    expect(formatDateKey(new Date('2026-01-31T16:30:00.000Z'))).toBe('2026-02-01')
  })

  it('支持闰年二月', () => {
    expect(monthRange('2024-02')).toEqual({ startDate: '2024-02-01', endDate: '2024-02-29' })
  })

  it('跨年增加日期不会偏移', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })
})
