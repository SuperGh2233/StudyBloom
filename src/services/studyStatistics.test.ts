import { describe, expect, it } from 'vitest'
import { studyRangeFor } from './studyStatistics'

// 2026-08-11 是星期二。构造绝对时刻，避免依赖运行测试的机器时间。
const now = new Date('2026-08-11T10:00:00+08:00')

describe('学习统计时间范围', () => {
  it('今天范围只包含今天', () => {
    const range = studyRangeFor('today', now)
    expect(range.startDate).toBe('2026-08-11')
    expect(range.endDate).toBe('2026-08-11')
  })

  it('本周从周一开始到今天', () => {
    const range = studyRangeFor('week', now)
    expect(range.startDate).toBe('2026-08-10')
    expect(range.endDate).toBe('2026-08-11')
  })

  it('本月从 1 号开始到今天', () => {
    const range = studyRangeFor('month', now)
    expect(range.startDate).toBe('2026-08-01')
    expect(range.endDate).toBe('2026-08-11')
  })
})
