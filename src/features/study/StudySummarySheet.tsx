import { BookOpenCheck, CheckSquare, Clock, Hourglass, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '../../components/Button'
import type { StudySession } from '../../types'
import { formatDurationHuman } from '../../utils/studyDuration'

interface StudySummarySheetProps {
  session: StudySession | null
  sessionSeconds: number
  todaySeconds: number
  saving: boolean
  onClose: () => void
  onSave: (reflection: string, completeTask: boolean) => void
}

export function StudySummarySheet({ session, sessionSeconds, todaySeconds, saving, onClose, onSave }: StudySummarySheetProps) {
  const [reflection, setReflection] = useState('')
  const [completeTask, setCompleteTask] = useState(false)

  useEffect(() => {
    setReflection(session?.reflection ?? '')
    setCompleteTask(false)
  }, [session])

  useEffect(() => {
    if (!session) return
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !saving) onClose() }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [session, saving, onClose])

  useEffect(() => {
    if (!session || !window.visualViewport) return
    const viewport = window.visualViewport
    const updateKeyboardInset = () => {
      const visibleBottom = viewport.height + viewport.offsetTop
      document.documentElement.style.setProperty('--keyboard-inset', `${Math.max(0, window.innerHeight - visibleBottom)}px`)
    }
    updateKeyboardInset()
    viewport.addEventListener('resize', updateKeyboardInset)
    viewport.addEventListener('scroll', updateKeyboardInset)
    return () => {
      viewport.removeEventListener('resize', updateKeyboardInset)
      viewport.removeEventListener('scroll', updateKeyboardInset)
      document.documentElement.style.removeProperty('--keyboard-inset')
    }
  }, [session])

  if (!session) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#17231dcc] sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose() }}>
      <section className="pwa-keyboard-safe surface gentle-enter flex max-h-[min(90dvh,720px)] w-full flex-col overflow-hidden rounded-t-3xl sm:max-w-md sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="study-summary-title">
        <header className="flex shrink-0 items-start gap-3 border-b border-[var(--line)] px-5 py-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><BookOpenCheck size={21} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--accent-strong)]">学习小结</p>
            <h2 id="study-summary-title" className="mt-0.5 truncate font-bold">{session.taskTitleSnapshot || '自由学习'}</h2>
          </div>
          <button type="button" className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--muted)]" onClick={onClose} disabled={saving} aria-label="关闭学习小结"><X size={20} /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            <SummaryMetric icon={<Clock size={17} />} value={formatDurationHuman(sessionSeconds)} label="本次学习" />
            <SummaryMetric icon={<Hourglass size={17} />} value={`${session.pomodoroCompletedRounds} 轮`} label="番茄专注" />
            <SummaryMetric className="col-span-2" icon={<BookOpenCheck size={17} />} value={formatDurationHuman(todaySeconds)} label="今日累计" />
          </div>

          {session.taskId && (
            <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-soft)] px-3.5 py-2.5 text-sm font-semibold">
              <input type="checkbox" checked={completeTask} onChange={(event) => setCompleteTask(event.target.checked)} className="h-5 w-5 accent-[var(--accent-strong)]" />
              <CheckSquare size={18} className="text-[var(--accent-strong)]" aria-hidden="true" />
              同时将关联任务标记为完成
            </label>
          )}

          <label className="mt-4 block text-sm font-semibold" htmlFor="study-reflection">写一句学习感受（可选）</label>
          <textarea
            id="study-reflection"
            value={reflection}
            onChange={(event) => setReflection(event.target.value.slice(0, 500))}
            rows={4}
            maxLength={500}
            placeholder="例如：今天状态不错，英语阅读比昨天更顺。"
            className="focus-ring mt-2 w-full resize-none rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 text-base leading-6"
          />
          <p className="mt-1 text-right text-xs text-[var(--muted)]">{reflection.length}/500</p>
        </div>

        <footer className="safe-bottom shrink-0 border-t border-[var(--line)] bg-[var(--surface)] px-5 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={onClose} disabled={saving}>稍后再写</Button>
            <Button onClick={() => onSave(reflection.trim(), completeTask)} loading={saving}>保存总结</Button>
          </div>
        </footer>
      </section>
    </div>
  )
}

function SummaryMetric({ icon, value, label, className = '' }: { icon: ReactNode; value: string; label: string; className?: string }) {
  return (
    <div className={`min-w-0 rounded-xl bg-[var(--surface-soft)] p-3 ${className}`}>
      <span className="text-[var(--accent-strong)]">{icon}</span>
      <strong className="mt-2 block min-w-0 break-words text-sm leading-5">{value}</strong>
      <span className="text-[11px] text-[var(--muted)]">{label}</span>
    </div>
  )
}
