import { ListChecks, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { useTaskStudySummaries } from '../../hooks/useTaskStudySummaries'
import { listTasksByDate } from '../../services/tasks'
import type { Task, TaskStudySummary } from '../../types'
import { todayDateKey } from '../../utils/date'
import { getErrorMessage } from '../../utils/errorMessage'
import { TaskStudyProgress } from '../tasks/TaskStudyProgress'

interface TaskPickerProps {
  taskId: string | null
  onTaskChange: (taskId: string | null) => void
  refreshKey?: unknown
}

export function TaskPicker({ taskId, onTaskChange, refreshKey }: TaskPickerProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const defaultApplied = useRef(false)
  const summaries = useTaskStudySummaries(tasks.map((task) => task.id), refreshKey)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setTasks(await listTasksByDate(todayDateKey()))
    } catch (reason) {
      setError(getErrorMessage(reason, '读取今日任务失败'))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  // 选中的任务可能来自 URL 参数：加载后若不在今日任务里，回退为自由学习。
  useEffect(() => {
    if (!loading && taskId && !tasks.some((task) => task.id === taskId)) onTaskChange(null)
  }, [loading, tasks, taskId, onTaskChange])

  useEffect(() => {
    if (loading || defaultApplied.current || taskId) return
    defaultApplied.current = true
    const firstUnfinished = tasks.find((task) => !task.completed)
    if (firstUnfinished) onTaskChange(firstUnfinished.id)
  }, [loading, tasks, taskId, onTaskChange])

  return (
    <section className="surface rounded-2xl p-5" aria-label="今日任务选择">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><ListChecks size={21} strokeWidth={1.8} /></span>
        <div className="min-w-0">
          <h2 className="font-bold">今天学什么</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">可以关联一项今日任务，也可以自由学习。</p>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--rose-soft)] px-3.5 py-3 text-xs text-[var(--rose)]">
          <span className="min-w-0">{error}</span>
          <Button variant="secondary" className="shrink-0" icon={<RefreshCw size={15} />} onClick={() => void load()} aria-label="重新加载今日任务">重试</Button>
        </div>
      )}
      {loading && !error && <p className="mt-4 text-sm text-[var(--muted)]">正在读取今日任务...</p>}

      <div className="mt-4 grid gap-2" role="group" aria-label="选择要学习的任务">
        <OptionButton
          selected={taskId === null}
          title="自由学习（不关联任务）"
          onClick={() => onTaskChange(null)}
        />
        {tasks.map((task) => (
            <OptionButton
              key={task.id}
              selected={taskId === task.id}
              task={task}
              summary={summaries.get(task.id)}
              onClick={() => onTaskChange(task.id)}
            />
        ))}
      </div>
    </section>
  )
}

function OptionButton({ selected, title, task, summary, onClick }: { selected: boolean; title?: string; task?: Task; summary?: TaskStudySummary; onClick: () => void }) {
  const label = task?.title ?? title ?? ''
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`focus-ring grid min-h-11 w-full gap-0.5 rounded-xl border px-3.5 py-2.5 text-left transition ${selected ? 'border-[var(--accent-strong)] bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-soft)]'}`}
    >
      <span className={`min-w-0 truncate text-sm font-semibold ${task?.completed ? 'text-[var(--muted)] line-through decoration-[var(--line-strong)]' : ''}`}>{label}</span>
      {task && <TaskStudyProgress task={task} summary={summary} />}
    </button>
  )
}
