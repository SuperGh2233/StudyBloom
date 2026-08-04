import { getSupabase } from '../lib/supabase'
import type { Database, ExportPlanDay, ExportTask, StudyBloomExport } from '../types'
import { AppError, toAppError } from '../utils/errorMessage'
import { assertDateKey } from '../utils/date'
import { requireUser } from './auth'

type TaskRow = Database['public']['Tables']['tasks']['Row']
type PlanDayRow = Database['public']['Tables']['plan_days']['Row']

function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' }

export function validateImportData(input: string): StudyBloomExport {
  let raw: unknown
  try { raw = JSON.parse(input) } catch { throw new AppError('导入文件不是有效的 JSON', 'VALIDATION') }
  if (!isObject(raw) || raw.version !== 1 || !Array.isArray(raw.tasks) || !Array.isArray(raw.planDays)) throw new AppError('导入文件结构不正确', 'VALIDATION')
  const tasks: ExportTask[] = raw.tasks.map((item) => {
    if (!isObject(item)) throw new AppError('任务数据格式不正确', 'VALIDATION')
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    const sortOrder = Number(item.sortOrder)
    if (!title || title.length > 100 || !Number.isInteger(sortOrder) || sortOrder < 0) throw new AppError('任务数据格式不正确', 'VALIDATION')
    return { planDate: assertDateKey(item.planDate), title, completed: Boolean(item.completed), sortOrder }
  })
  const planDays: ExportPlanDay[] = raw.planDays.map((item) => {
    if (!isObject(item)) throw new AppError('日期设置格式不正确', 'VALIDATION')
    const note = typeof item.note === 'string' ? item.note : ''
    if (note.length > 1000) throw new AppError('导入备注过长', 'VALIDATION')
    return { planDate: assertDateKey(item.planDate), isRestDay: Boolean(item.isRestDay), note }
  })
  return { version: 1, exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date().toISOString(), tasks, planDays }
}

export async function exportAllDataJson(): Promise<string> {
  const user = await requireUser()
  try {
    const client = getSupabase()
    const [{ data: taskRows, error: taskError }, { data: dayRows, error: dayError }] = await Promise.all([
      client.from('tasks').select('*').eq('user_id', user.id).order('plan_date').order('sort_order'),
      client.from('plan_days').select('*').eq('user_id', user.id).order('plan_date'),
    ])
    if (taskError) throw taskError
    if (dayError) throw dayError
    const payload: StudyBloomExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      tasks: (taskRows as TaskRow[]).map((row) => ({ planDate: row.plan_date, title: row.title, completed: row.completed, sortOrder: row.sort_order })),
      planDays: (dayRows as PlanDayRow[]).map((row) => ({ planDate: row.plan_date, isRestDay: row.is_rest_day, note: row.note ?? '' })),
    }
    return JSON.stringify(payload, null, 2)
  } catch (error) {
    throw toAppError(error, '导出计划失败')
  }
}
