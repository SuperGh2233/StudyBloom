import { getSupabase } from '../lib/supabase';
import { requireUser } from './auth';
import type { Database, DateKey, DateRange, DailyStatistics, MonthlyStatistics, PlanDay, Task } from '../types';
import { addDays, assertDateKey, monthRange, todayDateKey, compareDateKeys, enumerateDateKeys } from '../utils/date';
import { toAppError } from '../utils/errorMessage';

type TaskRow = Database['public']['Tables']['tasks']['Row'];
type PlanDayRow = Database['public']['Tables']['plan_days']['Row'];

const mapTask = (row: TaskRow): Task => ({
  id: row.id,
  userId: row.user_id,
  planDate: row.plan_date,
  title: row.title,
  completed: row.completed,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapPlanDay = (row: PlanDayRow): PlanDay => ({
  id: row.id,
  userId: row.user_id,
  planDate: row.plan_date,
  isRestDay: row.is_rest_day,
  note: row.note ?? '',
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const daily = (date: DateKey, tasks: Task[], planDay: PlanDay | undefined, today: DateKey): DailyStatistics => {
  const completedTaskCount = tasks.filter((task) => task.completed).length;
  return {
    date,
    isRestDay: planDay?.isRestDay ?? false,
    taskCount: tasks.length,
    completedTaskCount,
    allCompleted: date <= today && !planDay?.isRestDay && tasks.length > 0 && completedTaskCount === tasks.length,
  };
};

/** Pure statistics calculation; rest days are skipped in streaks and future dates are ignored. */
export function calculateStatistics(
  tasks: Task[],
  planDays: PlanDay[],
  range: DateRange,
  today: DateKey = todayDateKey(),
): MonthlyStatistics {
  assertDateKey(range.startDate);
  assertDateKey(range.endDate);
  assertDateKey(today);
  const dates = enumerateDateKeys(range.startDate, range.endDate);
  const tasksByDate = new Map<DateKey, Task[]>();
  tasks.forEach((task) => {
    if (task.planDate >= range.startDate && task.planDate <= range.endDate) {
      tasksByDate.set(task.planDate, [...(tasksByDate.get(task.planDate) ?? []), task]);
    }
  });
  const daysByDate = new Map(planDays.map((planDay) => [planDay.planDate, planDay]));
  const days = dates.map((date) => daily(date, tasksByDate.get(date) ?? [], daysByDate.get(date), today));
  const considered = days.filter((day) => day.date <= today);
  const allCompletedDays = considered.filter((day) => day.allCompleted).length;
  const totalTaskCount = considered.reduce((sum, day) => sum + day.taskCount, 0);
  const completedTaskCount = considered.reduce((sum, day) => sum + day.completedTaskCount, 0);

  let currentStreak = 0;
  for (let index = considered.length - 1; index >= 0; index -= 1) {
    const day = considered[index];
    if (day.isRestDay) continue;
    if (!day.allCompleted) break;
    currentStreak += 1;
  }

  let longestStreak = 0;
  let running = 0;
  considered.forEach((day) => {
    if (day.isRestDay) return;
    if (day.allCompleted) {
      running += 1;
      longestStreak = Math.max(longestStreak, running);
    } else {
      running = 0;
    }
  });

  return {
    startDate: range.startDate,
    endDate: range.endDate,
    totalTaskCount,
    completedTaskCount,
    allCompletedDays,
    currentStreak,
    longestStreak,
    completionRate: totalTaskCount ? Math.round((completedTaskCount / totalTaskCount) * 10000) / 100 : 0,
    days,
  };
}

async function fetchStatistics(range: DateRange): Promise<MonthlyStatistics> {
  const user = await requireUser();
  try {
    const client = getSupabase();
    const [{ data: taskRows, error: taskError }, { data: planRows, error: planError }] = await Promise.all([
      client.from('tasks').select('*').eq('user_id', user.id).gte('plan_date', range.startDate).lte('plan_date', range.endDate),
      client.from('plan_days').select('*').eq('user_id', user.id).gte('plan_date', range.startDate).lte('plan_date', range.endDate),
    ]);
    if (taskError) throw taskError;
    if (planError) throw planError;
    return calculateStatistics((taskRows ?? []).map(mapTask), (planRows ?? []).map(mapPlanDay), range);
  } catch (error) {
    throw toAppError(error, '读取学习统计失败');
  }
}

export const getMonthlyStatistics = (month: string) => fetchStatistics(monthRange(month));

export const getStatistics = fetchStatistics;

export async function getDailyStatistics(planDate: DateKey): Promise<DailyStatistics> {
  assertDateKey(planDate);
  const stats = await fetchStatistics({ startDate: planDate, endDate: planDate });
  return stats.days[0];
}

export function getDateRangeStatistics(
  tasks: Task[],
  planDays: PlanDay[],
  startDate: DateKey,
  endDate: DateKey,
  today?: DateKey,
) {
  return calculateStatistics(tasks, planDays, { startDate, endDate }, today);
}

