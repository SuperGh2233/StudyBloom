import { describe, expect, it } from 'vitest'
import { countdownDays } from './countdown'

describe('目标日期倒计时', () => {
  it('正确区分未来、当天和过去', () => {
    expect(countdownDays('2026-12-20', '2026-12-18')).toBe(2)
    expect(countdownDays('2026-12-20', '2026-12-20')).toBe(0)
    expect(countdownDays('2026-12-20', '2026-12-21')).toBe(-1)
  })
})
