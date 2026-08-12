import { getSupabase } from '../lib/supabase'
import { requireUser } from './auth'
import type { Database, DateKey, Task, TaskInput, TaskUpdate } from '../types'
import { assertDateKey, monthRange } from '../utils/date'
import { AppError, toAppError } from '../utils/errorMessage'

type TaskRow = Database['public']['Tables']['tasks']['Row']
export const mapTask = (row: TaskRow): Task => ({ id: row.id, userId: row.user_id, planDate: row.plan_date, title: row.title, completed: row.completed, sortOrder: row.sort_order, estimatedMinutes: row.estimated_minutes, createdAt: row.created_at, updatedAt: row.updated_at })

const validateTitle = (title: string): string => {
  const value = title.trim()
  if (!value) throw new AppError('任务内容不能为空', 'VALIDATION')
  if (value.length > 100) throw new AppError('任务内容不能超过 100 个字符', 'VALIDATION')
  return value
}

const validateSortOrder = (value: number | undefined): number | undefined => {
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || value < 0) throw new AppError('任务排序必须是非负整数', 'VALIDATION')
  return value
}

const validateEstimatedMinutes = (value: number | null | undefined): number | null | undefined => {
  if (value === undefined || value === null) return value
  if (!Number.isInteger(value) || value < 1 || value > 1440) throw new AppError('预计时长需要在 1–1440 分钟之间', 'VALIDATION')
  return value
}

export async function listTasksByDate(planDate: DateKey): Promise<Task[]> {
  assertDateKey(planDate)
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase().from('tasks').select('*').eq('user_id', user.id).eq('plan_date', planDate).order('sort_order', { ascending: true }).order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map(mapTask)
  } catch (error) { throw toAppError(error, '读取任务失败') }
}

export async function hasAnyTask(): Promise<boolean> {
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase().from('tasks').select('id').eq('user_id', user.id).limit(1)
    if (error) throw error
    return Boolean(data?.length)
  } catch (error) { throw toAppError(error, '读取任务状态失败') }
}

export async function listTasksByMonth(month: string): Promise<Task[]> {
  const range = monthRange(month)
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase().from('tasks').select('*').eq('user_id', user.id).gte('plan_date', range.startDate).lte('plan_date', range.endDate).order('plan_date', { ascending: true }).order('sort_order', { ascending: true }).order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map(mapTask)
  } catch (error) { throw toAppError(error, '读取月度任务失败') }
}

export async function listTasksByRange(startDate: DateKey, endDate: DateKey): Promise<Task[]> {
  assertDateKey(startDate); assertDateKey(endDate)
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase().from('tasks').select('*').eq('user_id', user.id).gte('plan_date', startDate).lte('plan_date', endDate).order('plan_date').order('sort_order')
    if (error) throw error
    return (data ?? []).map(mapTask)
  } catch (error) { throw toAppError(error, '读取任务失败') }
}

export async function createTask(input: TaskInput): Promise<Task> {
  assertDateKey(input.planDate)
  const user = await requireUser()
  const sortOrder = validateSortOrder(input.sortOrder) ?? 0
  try {
    const { data, error } = await getSupabase().from('tasks').insert({ user_id: user.id, plan_date: input.planDate, title: validateTitle(input.title), completed: input.completed ?? false, sort_order: sortOrder, estimated_minutes: validateEstimatedMinutes(input.estimatedMinutes) ?? null }).select('*').single()
    if (error) throw error
    return mapTask(data)
  } catch (error) { throw toAppError(error, '创建任务失败') }
}

export async function updateTask(id: string, input: TaskUpdate): Promise<Task> {
  if (!id.trim()) throw new AppError('任务 ID 不能为空', 'VALIDATION')
  if (input.planDate !== undefined) assertDateKey(input.planDate)
  const user = await requireUser()
  const update: Database['public']['Tables']['tasks']['Update'] = {}
  if (input.planDate !== undefined) update.plan_date = input.planDate
  if (input.title !== undefined) update.title = validateTitle(input.title)
  if (input.completed !== undefined) update.completed = Boolean(input.completed)
  if (input.sortOrder !== undefined) update.sort_order = validateSortOrder(input.sortOrder)
  if (input.estimatedMinutes !== undefined) update.estimated_minutes = validateEstimatedMinutes(input.estimatedMinutes)
  if (!Object.keys(update).length) throw new AppError('没有需要更新的任务字段', 'VALIDATION')
  try {
    const { data, error } = await getSupabase().from('tasks').update(update).eq('id', id).eq('user_id', user.id).select('*').single()
    if (error) throw error
    return mapTask(data)
  } catch (error) { throw toAppError(error, '更新任务失败') }
}

export const setTaskCompleted = (id: string, completed: boolean) => updateTask(id, { completed })

export async function deleteTask(id: string): Promise<void> {
  if (!id.trim()) throw new AppError('任务 ID 不能为空', 'VALIDATION')
  const user = await requireUser()
  try {
    const { error } = await getSupabase().from('tasks').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
  } catch (error) { throw toAppError(error, '删除任务失败') }
}

export async function reorderTasks(taskIds: string[]): Promise<void> {
  if (!Array.isArray(taskIds) || taskIds.some((id) => !id.trim())) throw new AppError('任务排序数据不正确', 'VALIDATION')
  await requireUser()
  try { await Promise.all(taskIds.map((id, index) => updateTask(id, { sortOrder: index }))) }
  catch (error) { throw toAppError(error, '调整任务顺序失败') }
}

export const getTasksForDate = listTasksByDate
export const getTasksForMonth = listTasksByMonth
