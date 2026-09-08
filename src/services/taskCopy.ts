import { getSupabase } from '../lib/supabase'
import type { CopyMode, DateKey, Task } from '../types'
import { assertDateKey } from '../utils/date'
import { AppError, toAppError } from '../utils/errorMessage'
import { requireUser } from './auth'
import { listTasksByDate, mapTask } from './tasks'

type CopyTasksCache = { sourceTasks?: Task[]; targetTasks?: Task[] }

export async function copyTasks(sourceDate: DateKey, targetDate: DateKey, mode: CopyMode = 'overwrite', cache: CopyTasksCache = {}): Promise<Task[]> {
  assertDateKey(sourceDate); assertDateKey(targetDate)
  if (sourceDate === targetDate) throw new AppError('源日期和目标日期不能相同', 'VALIDATION')
  if (mode !== 'overwrite' && mode !== 'append') throw new AppError('复制模式不正确', 'VALIDATION')
  const user = await requireUser()
  const [sourceTasks, targetTasks] = await Promise.all([
    cache.sourceTasks ?? listTasksByDate(sourceDate),
    cache.targetTasks ?? listTasksByDate(targetDate),
  ])
  if (!sourceTasks.length) throw new AppError('源日期没有可复制的任务', 'NOT_FOUND')
  try {
    const client = getSupabase()
    if (mode === 'overwrite') {
      const { error } = await client.from('tasks').delete().eq('user_id', user.id).eq('plan_date', targetDate)
      if (error) throw error
    }
    const offset = mode === 'append' ? Math.max(-1, ...targetTasks.map((task) => task.sortOrder)) + 1 : 0
    const { data, error } = await client.from('tasks').insert(sourceTasks.map((task, index) => ({ user_id: user.id, plan_date: targetDate, title: task.title, completed: false, sort_order: offset + index, estimated_minutes: task.estimatedMinutes }))).select('*')
    if (error) throw error
    const copied = (data ?? []).map(mapTask)
    return mode === 'append' ? [...targetTasks, ...copied] : copied
  } catch (error) { throw toAppError(error, '复制任务失败') }
}
