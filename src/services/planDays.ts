import { getSupabase } from '../lib/supabase';
import { requireUser } from './auth';
import { listTasksByDate } from './tasks';
import type { Database, DateKey, CopyMode, PlanDay, PlanDayInput, PlanDayUpdate } from '../types';
import { assertDateKey, enumerateDateKeys, monthRange } from '../utils/date';
import { AppError, toAppError } from '../utils/errorMessage';

type PlanDayRow = Database['public']['Tables']['plan_days']['Row'];

const mapPlanDay = (row: PlanDayRow): PlanDay => ({
  id: row.id,
  userId: row.user_id,
  planDate: row.plan_date,
  isRestDay: row.is_rest_day,
  note: row.note ?? '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const validateNote = (note: string | undefined): string | undefined => {
  if (note === undefined) return undefined;
  const value = note.trim();
  if (value.length > 2000) throw new AppError('备注不能超过 2000 个字符', 'VALIDATION');
  return value;
};

export async function getPlanDay(planDate: DateKey): Promise<PlanDay | null> {
  assertDateKey(planDate);
  const user = await requireUser();
  try {
    const { data, error } = await getSupabase()
      .from('plan_days')
      .select('*')
      .eq('user_id', user.id)
      .eq('plan_date', planDate)
      .maybeSingle();
    if (error) throw error;
    return data ? mapPlanDay(data) : null;
  } catch (error) {
    throw toAppError(error, '读取计划日失败');
  }
}

export async function listPlanDaysByMonth(month: string): Promise<PlanDay[]> {
  const range = monthRange(month);
  const user = await requireUser();
  try {
    const { data, error } = await getSupabase()
      .from('plan_days')
      .select('*')
      .eq('user_id', user.id)
      .gte('plan_date', range.startDate)
      .lte('plan_date', range.endDate)
      .order('plan_date', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapPlanDay);
  } catch (error) {
    throw toAppError(error, '读取月度计划日失败');
  }
}

export async function upsertPlanDay(input: PlanDayInput): Promise<PlanDay> {
  assertDateKey(input.planDate);
  const user = await requireUser();
  const note = validateNote(input.note);
  try {
    const { data, error } = await getSupabase()
      .from('plan_days')
      .upsert(
        {
          user_id: user.id,
          plan_date: input.planDate,
          is_rest_day: input.isRestDay ?? false,
          ...(note === undefined ? {} : { note }),
        },
        { onConflict: 'user_id,plan_date' },
      )
      .select('*')
      .single();
    if (error) throw error;
    return mapPlanDay(data);
  } catch (error) {
    throw toAppError(error, '保存计划日失败');
  }
}

export async function updatePlanDay(id: string, input: PlanDayUpdate): Promise<PlanDay> {
  if (!id.trim()) throw new AppError('计划日 ID 不能为空', 'VALIDATION');
  const update: Database['public']['Tables']['plan_days']['Update'] = {};
  if (input.isRestDay !== undefined) update.is_rest_day = Boolean(input.isRestDay);
  if (input.note !== undefined) update.note = validateNote(input.note);
  if (!Object.keys(update).length) throw new AppError('没有需要更新的计划日字段', 'VALIDATION');
  const user = await requireUser();
  try {
    const { data, error } = await getSupabase()
      .from('plan_days')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();
    if (error) throw error;
    return mapPlanDay(data);
  } catch (error) {
    throw toAppError(error, '更新计划日失败');
  }
}

export const setRestDay = (planDate: DateKey, isRestDay: boolean, note = '') =>
  upsertPlanDay({ planDate, isRestDay, note });

export const setPlanDayNote = (planDate: DateKey, note: string) => upsertPlanDay({ planDate, note });

export async function deletePlanDay(id: string): Promise<void> {
  if (!id.trim()) throw new AppError('计划日 ID 不能为空', 'VALIDATION');
  const user = await requireUser();
  try {
    const { error } = await getSupabase().from('plan_days').delete().eq('id', id).eq('user_id', user.id);
    if (error) throw error;
  } catch (error) {
    throw toAppError(error, '删除计划日失败');
  }
}

export async function copyPlanDay(sourceDate: DateKey, targetDate: DateKey, mode: CopyMode = 'overwrite') {
  assertDateKey(sourceDate);
  assertDateKey(targetDate);
  if (sourceDate === targetDate) throw new AppError('源日期和目标日期不能相同', 'VALIDATION');
  if (mode !== 'overwrite' && mode !== 'append') throw new AppError('复制模式不正确', 'VALIDATION');
  const user = await requireUser();
  const [sourcePlanDay, sourceTasks, targetPlanDay, targetTasks] = await Promise.all([
    getPlanDay(sourceDate),
    listTasksByDate(sourceDate),
    getPlanDay(targetDate),
    listTasksByDate(targetDate),
  ]);
  if (!sourcePlanDay && sourceTasks.length === 0) throw new AppError('源日期没有可复制的内容', 'NOT_FOUND');
  try {
    const client = getSupabase();
    if (mode === 'overwrite') {
      const { error } = await client.from('tasks').delete().eq('user_id', user.id).eq('plan_date', targetDate);
      if (error) throw error;
    }
    if (sourcePlanDay && (mode === 'overwrite' || !targetPlanDay)) {
      const { error } = await client.from('plan_days').upsert(
        {
          user_id: user.id,
          plan_date: targetDate,
          is_rest_day: sourcePlanDay.isRestDay,
          note: sourcePlanDay.note,
        },
        { onConflict: 'user_id,plan_date' },
      );
      if (error) throw error;
    }
    if (sourceTasks.length) {
      const offset = mode === 'append' ? Math.max(-1, ...targetTasks.map((task) => task.sortOrder)) + 1 : 0;
      const { error } = await client.from('tasks').insert(
        sourceTasks.map((task, index) => ({
          user_id: user.id,
          plan_date: targetDate,
          title: task.title,
          completed: task.completed,
          sort_order: offset + (mode === 'append' ? index : task.sortOrder),
        })),
      );
      if (error) throw error;
    }
    return { planDay: await getPlanDay(targetDate), tasks: await listTasksByDate(targetDate) };
  } catch (error) {
    throw toAppError(error, '复制计划失败');
  }
}

/** Copy matching day numbers between months; dates beyond the target month are skipped. */
export async function copyPlanMonth(sourceMonth: string, targetMonth: string, mode: CopyMode = 'overwrite') {
  const sourceRange = monthRange(sourceMonth);
  const targetRange = monthRange(targetMonth);
  const targetDates = new Set(enumerateDateKeys(targetRange.startDate, targetRange.endDate));
  const sourceDates = enumerateDateKeys(sourceRange.startDate, sourceRange.endDate);
  const results = [];
  for (const sourceDate of sourceDates) {
    const targetDate = `${targetMonth}-${sourceDate.slice(8)}`;
    if (targetDates.has(targetDate)) results.push(await copyPlanDay(sourceDate, targetDate, mode));
  }
  return results;
}

export const copyPlan = copyPlanDay;

