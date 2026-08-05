import { getSupabase } from '../lib/supabase';
import { requireUser } from './auth';
import { mapTask } from './tasks';
import { mapPlanDay } from './planDays';
import type { PlanDay, Task } from '../types';
import { AppError, toAppError } from '../utils/errorMessage';
import { monthRange } from '../utils/date';

export interface FriendMonth {
  tasks: Task[];
  planDays: PlanDay[];
}

/**
 * Read-only month of another user's calendar. RLS on tasks/plan_days only
 * returns rows when the owner has an active calendar_shares grant for me, so
 * this can never leak or mutate data. No write helpers exist for friends.
 */
export async function getFriendMonth(ownerId: string, month: string): Promise<FriendMonth> {
  if (!ownerId.trim()) throw new AppError('好友不存在', 'VALIDATION');
  const user = await requireUser();
  if (ownerId === user.id) throw new AppError('不能以好友身份查看自己的日历', 'VALIDATION');
  const range = monthRange(month);
  try {
    const [tasksResult, daysResult] = await Promise.all([
      getSupabase()
        .from('tasks')
        .select('*')
        .eq('user_id', ownerId)
        .gte('plan_date', range.startDate)
        .lte('plan_date', range.endDate)
        .order('plan_date', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      getSupabase()
        .from('plan_days')
        .select('*')
        .eq('user_id', ownerId)
        .gte('plan_date', range.startDate)
        .lte('plan_date', range.endDate)
        .order('plan_date', { ascending: true }),
    ]);
    if (tasksResult.error) throw tasksResult.error;
    if (daysResult.error) throw daysResult.error;
    return {
      tasks: (tasksResult.data ?? []).map(mapTask),
      planDays: (daysResult.data ?? []).map(mapPlanDay),
    };
  } catch (error) {
    throw toAppError(error, '读取好友日历失败');
  }
}
