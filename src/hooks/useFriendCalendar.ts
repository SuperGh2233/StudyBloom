import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { canViewFriendCalendar } from '../services/calendarShares'
import { getFriendMonth } from '../services/friendCalendar'
import type { PlanDay, Task } from '../types'
import { getErrorMessage } from '../utils/errorMessage'

/** Read-only month data for a friend's calendar; allowed=null while loading. */
export function useFriendCalendar(ownerId: string, monthDate: Date) {
  const monthKey = format(monthDate, 'yyyy-MM')
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [planDays, setPlanDays] = useState<PlanDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!ownerId) return
    setLoading(true); setError('')
    try {
      const canView = await canViewFriendCalendar(ownerId)
      setAllowed(canView)
      if (canView) {
        const month = await getFriendMonth(ownerId, monthKey)
        setTasks(month.tasks); setPlanDays(month.planDays)
      } else {
        setTasks([]); setPlanDays([])
      }
    } catch (reason) { setError(getErrorMessage(reason, '好友日历加载失败')) }
    finally { setLoading(false) }
  }, [ownerId, monthKey])
  useEffect(() => { void load() }, [load])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) map.set(task.planDate, [...(map.get(task.planDate) ?? []), task])
    for (const items of map.values()) items.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
    return map
  }, [tasks])
  const planDaysByDate = useMemo(() => new Map(planDays.map((day) => [day.planDate, day])), [planDays])

  return { monthKey, allowed, tasks, planDays, tasksByDate, planDaysByDate, loading, error, reload: load }
}
