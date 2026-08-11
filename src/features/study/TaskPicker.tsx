import { ListChecks, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/Button'
import { listTasksByDate } from '../../services/tasks'
import type { StudySession, StudySessionSegment, Task } from '../../types'
import { todayDateKey } from '../../utils/date'
import { getErrorMessage } from '../../utils/errorMessage'
import { formatDurationHuman, sessionElapsedSeconds } from '../../utils/studyDuration'

interface TaskPickerProps {
  taskId: string | null
  onTaskChange: (taskId: string | null) => void
  sessions: StudySession[]
  segments: StudySessionSegment[]
  nowMs: number
}

export function TaskPicker({ taskId, onTaskChange, sessions, segments, nowMs }: TaskPickerProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  const secondsByTask = useMemo(() => {
    const map = new Map<string, number>()
    for (const session of sessions) {
      if (!session.taskId) continue
      map.set(session.taskId, (map.get(session.taskId) ?? 0) + sessionElapsedSeconds(session, segments, nowMs))
    }
    return map
  }, [sessions, segments, nowMs])

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
        {tasks.map((task) => {
          const seconds = secondsByTask.get(task.id) ?? 0
          return (
            <OptionButton
              key={task.id}
              selected={taskId === task.id}
              title={task.title}
              detail={seconds > 0 ? `今日已学习 ${formatDurationHuman(seconds)}` : undefined}
              completed={task.completed}
              onClick={() => onTaskChange(task.id)}
            />
          )
        })}
      </div>
    </section>
  )
}

function OptionButton({ selected, title, detail, completed, onClick }: { selected: boolean; title: string; detail?: string; completed?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`focus-ring grid min-h-11 w-full gap-0.5 rounded-xl border px-3.5 py-2.5 text-left transition ${selected ? 'border-[var(--accent-strong)] bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-soft)]'}`}
    >
      <span className={`min-w-0 truncate text-sm font-semibold ${completed ? 'text-[var(--muted)] line-through decoration-[var(--line-strong)]' : ''}`}>{title}</span>
      {detail && <span className="text-xs text-[var(--muted)]">{detail}</span>}
    </button>
  )
}
