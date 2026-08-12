import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { BookOpen, Clock3, History, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/Button'
import { LoadingState } from '../../components/LoadingState'
import { fetchStudyDataForTasks } from '../../services/studySessions'
import type { StudySession, StudySessionSegment, Task } from '../../types'
import { getErrorMessage } from '../../utils/errorMessage'
import { formatDurationHuman, sessionElapsedSeconds } from '../../utils/studyDuration'
import { calculateTaskStudySummaries } from '../../utils/taskStudy'
import { TaskStudyProgress } from './TaskStudyProgress'

interface TaskStudyDetailProps {
  task: Task | null
  onClose: () => void
}

export function TaskStudyDetail({ task, onClose }: TaskStudyDetailProps) {
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [segments, setSegments] = useState<StudySessionSegment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!task) return
    setLoading(true)
    setError('')
    try {
      const data = await fetchStudyDataForTasks([task.id])
      setSessions(data.sessions)
      setSegments(data.segments)
    } catch (reason) {
      setError(getErrorMessage(reason, '读取任务学习记录失败'))
    } finally {
      setLoading(false)
    }
  }, [task])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!task) return
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [task, onClose])

  const summary = useMemo(() => task ? calculateTaskStudySummaries(sessions, segments).get(task.id) : undefined, [task, sessions, segments])
  if (!task) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#17231dcc] sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="surface drawer-enter safe-bottom flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl sm:max-w-lg sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="task-study-title">
        <header className="flex shrink-0 items-start gap-3 border-b border-[var(--line)] px-5 py-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><History size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--accent-strong)]">任务学习详情</p>
            <h2 id="task-study-title" className="mt-0.5 break-words font-bold">{task.title}</h2>
          </div>
          <button type="button" className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--muted)]" onClick={onClose} aria-label="关闭任务学习详情"><X size={20} /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {loading ? <LoadingState label="正在读取学习记录..." /> : error ? (
            <div className="rounded-xl bg-[var(--rose-soft)] p-4 text-sm text-[var(--rose)]">
              <p>{error}</p>
              <Button className="mt-3" variant="secondary" icon={<RefreshCw size={16} />} onClick={() => void load()}>重试</Button>
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-[var(--surface-soft)] p-4">
                <TaskStudyProgress task={task} summary={summary} />
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-xs text-[var(--muted)]">学习次数</span><strong className="mt-1 block text-lg">{summary?.sessionCount ?? 0} 次</strong></div>
                  <div><span className="text-xs text-[var(--muted)]">最近学习</span><strong className="mt-1 block text-sm leading-6">{summary?.lastStudiedAt ? format(new Date(summary.lastStudiedAt), 'M月d日 HH:mm', { locale: zhCN }) : '还没有记录'}</strong></div>
                </div>
              </div>

              <h3 className="mt-5 flex items-center gap-2 font-bold"><BookOpen size={18} className="text-[var(--accent-strong)]" />最近学习记录</h3>
              {sessions.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">完成一次关联学习后，记录会出现在这里。</div>
              ) : (
                <div className="mt-3 grid gap-2">
                  {sessions.slice(0, 10).map((session) => (
                    <article key={session.id} className="rounded-xl border border-[var(--line)] p-3.5">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <strong className="min-w-0 truncate text-sm">{format(new Date(session.startedAt), 'M月d日 EEEE HH:mm', { locale: zhCN })}</strong>
                        <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--accent-strong)]">{session.mode === 'pomodoro' ? '番茄专注' : '自由计时'}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                        <span className="flex items-center gap-1"><Clock3 size={14} />{formatDurationHuman(sessionElapsedSeconds(session, segments))}</span>
                        {session.mode === 'pomodoro' && <span>{session.pomodoroCompletedRounds} 轮番茄</span>}
                      </div>
                      {session.reflection && <p className="mt-2 [overflow-wrap:anywhere] rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-sm leading-6 text-[var(--muted)]">{session.reflection}</p>}
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}
