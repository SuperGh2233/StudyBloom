import { useCallback, useEffect, useState } from 'react'
import type { Task } from '../types'
import * as taskService from '../services/tasks'
import { todayDateKey } from '../utils/date'
import { getErrorMessage } from '../utils/errorMessage'

export function useTodayTasks(refreshKey: unknown = 0) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const today = todayDateKey()

  const reload = useCallback(async () => {
    setLoading(true); setError('')
    try { setTasks(await taskService.listTasksByDate(today)) }
    catch (reason) { setError(getErrorMessage(reason, '读取今日任务失败')) }
    finally { setLoading(false) }
  }, [today])

  useEffect(() => { void reload() }, [reload, refreshKey])

  const addTask = useCallback(async (title: string, estimatedMinutes: number) => {
    const created = await taskService.createTask({ planDate: today, title, estimatedMinutes, sortOrder: tasks.length })
    setTasks((items) => [...items, created])
    return created
  }, [tasks.length, today])

  return { tasks, loading, error, addTask, reload }
}
