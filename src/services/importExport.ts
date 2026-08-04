import { getSupabase } from '../lib/supabase'
import { requireUser } from './auth'
import type { Database, DateKey, DateRange, ImportResult, StudyBloomExport, ExportPlanDay, ExportTask, CopyMode } from '../types'
import { assertDateKey, enumerateDateKeys } from '../utils/date'
import { AppError, toAppError } from '../utils/errorMessage'

type TaskRow = Database['public']['Tables']['tasks']['Row']
type PlanDayRow = Database['public']['Tables']['plan_days']['Row']
export interface ImportOptions { mode?: CopyMode }

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object'

const parseInput = (input: string | StudyBloomExport): Record<string, unknown> => {
  if (typeof input !== 'string') return input as unknown as Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(input)
    if (!isRecord(parsed)) throw new Error('not object')
    return parsed
  } catch { throw new AppError('导入文件不是有效的 JSON', 'VALIDATION') }
}

const parseDate = (value: unknown): DateKey => {
  try { return assertDateKey(value) }
  catch { throw new AppError('导入数据包含无效日期', 'VALIDATION') }
}

const parseTasks = (value: unknown): ExportTask[] => {
  if (!Array.isArray(value)) throw new AppError('导入数据缺少 tasks 数组', 'VALIDATION')
  return value.map((item) => {
    if (!isRecord(item)) throw new AppError('任务数据格式不正确', 'VALIDATION')
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    if (!title || title.length > 100) throw new AppError('导入任务内容不正确', 'VALIDATION')
    const sortOrder = item.sortOrder === undefined ? 0 : Number(item.sortOrder)
    if (!Number.isInteger(sortOrder) || sortOrder < 0) throw new AppError('导入任务排序不正确', 'VALIDATION')
    return { planDate: parseDate(item.planDate), title, completed: Boolean(item.completed), sortOrder }
  })
}

const parsePlanDays = (value: unknown): ExportPlanDay[] => {
  if (!Array.isArray(value)) throw new AppError('导入数据缺少 planDays 数组', 'VALIDATION')
  const byDate = new Map<DateKey, ExportPlanDay>()
  value.forEach((item) => {
    if (!isRecord(item)) throw new AppError('计划日数据格式不正确', 'VALIDATION')
    const planDate = parseDate(item.planDate)
    const note = typeof item.note === 'string' ? item.note.trim() : ''
    if (note.length > 1000) throw new AppError('导入备注过长', 'VALIDATION')
    byDate.set(planDate, { planDate, isRestDay: Boolean(item.isRestDay), note })
  })
  return [...byDate.values()]
}

const rangeFromDates = (dates: DateKey[]): DateRange | null => {
  if (!dates.length) return null
  const sorted = [...dates].sort()
  return { startDate: sorted[0], endDate: sorted[sorted.length - 1] }
}

export async function exportPlan(range: DateRange): Promise<StudyBloomExport> {
  assertDateKey(range.startDate); assertDateKey(range.endDate)
  if (range.startDate > range.endDate) throw new AppError('导出日期范围不正确', 'VALIDATION')
  const user = await requireUser()
  try {
    const client = getSupabase()
    const [{ data: taskRows, error: taskError }, { data: planRows, error: planError }] = await Promise.all([
      client.from('tasks').select('*').eq('user_id', user.id).gte('plan_date', range.startDate).lte('plan_date', range.endDate).order('plan_date').order('sort_order'),
      client.from('plan_days').select('*').eq('user_id', user.id).gte('plan_date', range.startDate).lte('plan_date', range.endDate).order('plan_date'),
    ])
    if (taskError) throw taskError
    if (planError) throw planError
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks: (taskRows as TaskRow[]).map((row) => ({ planDate: row.plan_date, title: row.title, completed: row.completed, sortOrder: row.sort_order })),
      planDays: (planRows as PlanDayRow[]).map((row) => ({ planDate: row.plan_date, isRestDay: row.is_rest_day, note: row.note ?? '' })),
    }
  } catch (error) { throw toAppError(error, '导出计划失败') }
}

export async function exportPlanJson(range: DateRange): Promise<string> { return JSON.stringify(await exportPlan(range), null, 2) }

export async function importPlan(input: string | StudyBloomExport, options: ImportOptions = {}): Promise<ImportResult> {
  const payload = parseInput(input)
  if (payload.version !== undefined && Number(payload.version) !== 1) throw new AppError('不支持的导入文件版本', 'VALIDATION')
  const tasks = parseTasks(payload.tasks)
  const planDays = parsePlanDays(payload.planDays)
  const mode = options.mode ?? 'overwrite'
  if (mode !== 'overwrite' && mode !== 'append') throw new AppError('导入模式不正确', 'VALIDATION')
  const dates = [...new Set([...tasks.map((task) => task.planDate), ...planDays.map((day) => day.planDate)])]
  if (!dates.length) return { taskCount: 0, planDayCount: 0 }
  const range = rangeFromDates(dates)!
  enumerateDateKeys(range.startDate, range.endDate)
  const user = await requireUser()
  try {
    const client = getSupabase()
    if (mode === 'overwrite') {
      const { error: taskDeleteError } = await client.from('tasks').delete().eq('user_id', user.id).in('plan_date', dates)
      if (taskDeleteError) throw taskDeleteError
      const { error: dayDeleteError } = await client.from('plan_days').delete().eq('user_id', user.id).in('plan_date', dates)
      if (dayDeleteError) throw dayDeleteError
    }

    let planDayCount = 0
    if (planDays.length) {
      let daysToInsert = planDays
      if (mode === 'append') {
        const { data: existing, error } = await client.from('plan_days').select('plan_date').eq('user_id', user.id).in('plan_date', dates)
        if (error) throw error
        const existingDates = new Set((existing ?? []).map((row) => row.plan_date))
        daysToInsert = planDays.filter((day) => !existingDates.has(day.planDate))
      }
      if (daysToInsert.length) {
        const { error } = await client.from('plan_days').insert(daysToInsert.map((day) => ({ user_id: user.id, plan_date: day.planDate, is_rest_day: day.isRestDay, note: day.note })))
        if (error) throw error
        planDayCount = daysToInsert.length
      }
    }

    let taskCount = 0
    if (tasks.length) {
      const offsets = new Map<DateKey, number>()
      if (mode === 'append') {
        const { data: existing, error } = await client.from('tasks').select('plan_date,sort_order').eq('user_id', user.id).in('plan_date', dates)
        if (error) throw error
        ;(existing ?? []).forEach((row) => offsets.set(row.plan_date, Math.max(offsets.get(row.plan_date) ?? -1, row.sort_order) + 1))
      }
      const rows = tasks.map((task) => {
        const offset = offsets.get(task.planDate) ?? 0
        if (mode === 'append') offsets.set(task.planDate, offset + 1)
        return { user_id: user.id, plan_date: task.planDate, title: task.title, completed: task.completed, sort_order: mode === 'append' ? offset : task.sortOrder }
      })
      const { error } = await client.from('tasks').insert(rows)
      if (error) throw error
      taskCount = tasks.length
    }
    return { taskCount, planDayCount }
  } catch (error) { throw toAppError(error, '导入计划失败') }
}

export const exportData = exportPlanJson
export const importData = importPlan
