import { describe, expect, it } from 'vitest'
import { countGoalMetDays, studyRangeFor, weeklySummary } from './studyStatistics'

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

describe('学习目标和周报', () => {
  it('按目标分钟数统计达成天数', () => {
    expect(countGoalMetDays([
      { date: '2026-08-10', seconds: 7200, pomodoroRounds: 2 },
      { date: '2026-08-11', seconds: 7199, pomodoroRounds: 1 },
    ], 120)).toBe(1)
  })

  it('周报总结由现有数据生成', () => {
    expect(weeklySummary(3600, 20, 2, '英语阅读')).toContain('比上周多投入')
    expect(weeklySummary(0, null, 0, null)).toContain('还没有学习记录')
  })
})
