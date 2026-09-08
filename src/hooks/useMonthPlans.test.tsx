import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '../types'

const mocks = vi.hoisted(() => ({
  listTasksByMonth: vi.fn(),
  listPlanDaysByMonth: vi.fn(),
  copyTasks: vi.fn(),
}))

vi.mock('../services/tasks', () => ({ listTasksByMonth: mocks.listTasksByMonth }))
vi.mock('../services/planDays', () => ({ listPlanDaysByMonth: mocks.listPlanDaysByMonth }))
vi.mock('../services/taskCopy', () => ({ copyTasks: mocks.copyTasks }))

import { useMonthPlans } from './useMonthPlans'

const task = (id: string, planDate: string, sortOrder: number): Task => ({
  id,
  userId: 'user-1',
  planDate,
  title: `任务 ${id}`,
  completed: false,
  sortOrder,
  estimatedMinutes: null,
  createdAt: '2026-09-08T00:00:00Z',
  updatedAt: '2026-09-08T00:00:00Z',
})

describe('useMonthPlans 复制计划', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listTasksByMonth.mockResolvedValue([task('source', '2026-09-07', 0)])
    mocks.listPlanDaysByMonth.mockResolvedValue([])
    mocks.copyTasks.mockResolvedValue([task('copied', '2026-09-08', 0)])
  })

  it('复制后直接更新本地目标日期，不重新加载整月数据', async () => {
    const { result } = renderHook(() => useMonthPlans(new Date(2026, 8, 1)))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.copyDay('2026-09-07', '2026-09-08', 'append') })

    expect(mocks.copyTasks).toHaveBeenCalledWith('2026-09-07', '2026-09-08', 'append', {
      sourceTasks: [expect.objectContaining({ id: 'source' })],
      targetTasks: [],
    })
    expect(result.current.tasksByDate.get('2026-09-08')?.map((item) => item.id)).toEqual(['copied'])
    expect(mocks.listTasksByMonth).toHaveBeenCalledTimes(1)
    expect(mocks.listPlanDaysByMonth).toHaveBeenCalledTimes(1)
  })
})
