import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import type { CopyMode, PlanDay, Task, TaskUpdate } from '../types'
import * as taskService from '../services/tasks'
import * as planDayService from '../services/planDays'
import { copyTasks } from '../services/taskCopy'
import { getErrorMessage } from '../utils/errorMessage'

export function useMonthPlans(monthDate: Date) {
  const monthKey = format(monthDate, 'yyyy-MM')
  const [tasks, setTasks] = useState<Task[]>([])
  const [planDays, setPlanDays] = useState<PlanDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const [nextTasks, nextPlanDays] = await Promise.all([taskService.listTasksByMonth(monthKey), planDayService.listPlanDaysByMonth(monthKey)])
      setTasks(nextTasks); setPlanDays(nextPlanDays)
    } catch (reason) { setError(getErrorMessage(reason, '本月计划加载失败')) }
    finally { setLoading(false) }
  }, [monthKey])
  useEffect(() => { void load() }, [load])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) map.set(task.planDate, [...(map.get(task.planDate) ?? []), task])
    for (const items of map.values()) items.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
    return map
  }, [tasks])
  const planDaysByDate = useMemo(() => new Map(planDays.map((day) => [day.planDate, day])), [planDays])

  const addTask = useCallback(async (planDate: string, title: string, estimatedMinutes: number | null = null) => {
    const created = await taskService.createTask({ planDate, title, estimatedMinutes, sortOrder: (tasksByDate.get(planDate) ?? []).length })
    setTasks((items) => [...items, created]); return created
  }, [tasksByDate])

  const updateTask = useCallback(async (id: string, update: TaskUpdate) => {
    const previous = tasks
    setTasks((items) => items.map((task) => task.id === id ? { ...task, ...update } : task))
    try { const saved = await taskService.updateTask(id, update); setTasks((items) => items.map((task) => task.id === id ? saved : task)) }
    catch (reason) { setTasks(previous); throw reason }
  }, [tasks])

  const toggleTask = useCallback(async (id: string, completed: boolean) => {
    const previous = tasks
    setTasks((items) => items.map((task) => task.id === id ? { ...task, completed } : task))
    try { const saved = await taskService.setTaskCompleted(id, completed); setTasks((items) => items.map((task) => task.id === id ? saved : task)) }
    catch (reason) { setTasks(previous); throw reason }
  }, [tasks])

  const removeTask = useCallback(async (id: string) => {
    const previous = tasks
    setTasks((items) => items.filter((task) => task.id !== id))
    try { await taskService.deleteTask(id) }
    catch (reason) { setTasks(previous); throw reason }
  }, [tasks])

  const moveTask = useCallback(async (planDate: string, id: string, direction: -1 | 1) => {
    const current = [...(tasksByDate.get(planDate) ?? [])]
    const index = current.findIndex((task) => task.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= current.length) return
    ;[current[index], current[target]] = [current[target], current[index]]
    const order = new Map(current.map((task, sortOrder) => [task.id, sortOrder]))
    const previous = tasks
    setTasks((items) => items.map((task) => order.has(task.id) ? { ...task, sortOrder: order.get(task.id)! } : task))
    try { await taskService.reorderTasks(current.map((task) => task.id)) }
    catch (reason) { setTasks(previous); throw reason }
  }, [tasks, tasksByDate])

  const savePlanDay = useCallback(async (planDate: string, update: { note?: string; isRestDay?: boolean }) => {
    const existing = planDaysByDate.get(planDate)
    const saved = await planDayService.upsertPlanDay({ planDate, note: update.note ?? existing?.note ?? '', isRestDay: update.isRestDay ?? existing?.isRestDay ?? false })
    setPlanDays((items) => [...items.filter((item) => item.planDate !== planDate), saved]); return saved
  }, [planDaysByDate])

  const copyDay = useCallback(async (sourceDate: string, targetDate: string, mode: CopyMode) => { await copyTasks(sourceDate, targetDate, mode); await load(true) }, [load])

  return { monthKey, tasks, planDays, tasksByDate, planDaysByDate, loading, error, reload: load, addTask, updateTask, toggleTask, removeTask, moveTask, savePlanDay, copyDay }
}
