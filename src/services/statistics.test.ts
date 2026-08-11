import { describe, expect, it } from 'vitest'
import type { PlanDay, Task } from '../types'
import { calculateStatistics } from './statistics'

const task = (id: string, planDate: string, completed = true): Task => ({
  id,
  userId: 'user-a',
  planDate,
  title: `任务 ${id}`,
  completed,
  sortOrder: 0,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
})

const restDay = (planDate: string): PlanDay => ({
  id: `rest-${planDate}`,
  userId: 'user-a',
  planDate,
  isRestDay: true,
  note: '',
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
})

describe('学习统计', () => {
  it('休息日不增加也不中断连续完成，未来任务不参与', () => {
    const result = calculateStatistics(
      [task('1', '2026-08-01'), task('2', '2026-08-02'), task('4', '2026-08-04'), task('5', '2026-08-05')],
      [restDay('2026-08-03')],
      { startDate: '2026-08-01', endDate: '2026-08-07' },
      '2026-08-04',
    )
    expect(result.currentStreak).toBe(3)
    expect(result.longestStreak).toBe(3)
    expect(result.allCompletedDays).toBe(3)
    expect(result.totalTaskCount).toBe(3)
    expect(result.completionRate).toBe(100)
  })

  it('空数据完成率为 0，不产生 NaN', () => {
    const result = calculateStatistics([], [], { startDate: '2026-08-01', endDate: '2026-08-31' }, '2026-08-04')
    expect(result.completionRate).toBe(0)
    expect(Number.isNaN(result.completionRate)).toBe(false)
  })

  it('存在未完成任务时不算全部完成', () => {
    const result = calculateStatistics([task('1', '2026-08-01'), task('2', '2026-08-01', false)], [], { startDate: '2026-08-01', endDate: '2026-08-01' }, '2026-08-01')
    expect(result.days[0].allCompleted).toBe(false)
    expect(result.completionRate).toBe(50)
  })
})
