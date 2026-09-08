import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database, Task } from '../types'

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  listTasksByDate: vi.fn(),
  requireUser: vi.fn(),
}))

vi.mock('./auth', () => ({ requireUser: mocks.requireUser }))
vi.mock('./tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('./tasks')>()
  return { ...original, listTasksByDate: mocks.listTasksByDate }
})
vi.mock('../lib/supabase', () => ({
  getSupabase: () => ({ from: () => ({ insert: mocks.insert }) }),
}))

import { copyTasks } from './taskCopy'

const task = (id: string, planDate: string, sortOrder: number): Task => ({
  id,
  userId: 'user-1',
  planDate,
  title: `任务 ${id}`,
  completed: false,
  sortOrder,
  estimatedMinutes: 30,
  createdAt: '2026-09-08T00:00:00Z',
  updatedAt: '2026-09-08T00:00:00Z',
})

const row = (value: Task): Database['public']['Tables']['tasks']['Row'] => ({
  id: value.id,
  user_id: value.userId,
  plan_date: value.planDate,
  title: value.title,
  completed: value.completed,
  sort_order: value.sortOrder,
  estimated_minutes: value.estimatedMinutes,
  created_at: value.createdAt,
  updated_at: value.updatedAt,
})

describe('复制任务', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ id: 'user-1' })
  })

  it('使用月历已有数据复制，不重复读取源日期、目标日期或复制结果', async () => {
    const source = [task('source-1', '2026-09-07', 0)]
    const existing = [task('target-1', '2026-09-08', 0)]
    const copied = task('copied-1', '2026-09-08', 1)
    const select = vi.fn().mockResolvedValue({ data: [row(copied)], error: null })
    mocks.insert.mockReturnValue({ select })

    const result = await copyTasks('2026-09-07', '2026-09-08', 'append', { sourceTasks: source, targetTasks: existing })

    expect(mocks.listTasksByDate).not.toHaveBeenCalled()
    expect(mocks.insert).toHaveBeenCalledTimes(1)
    expect(result.map((item) => item.id)).toEqual(['target-1', 'copied-1'])
  })
})
