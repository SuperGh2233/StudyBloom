import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Clock3, Sprout, X } from 'lucide-react'
import { Button } from '../../components/Button'
import type { StudyMode, Task } from '../../types'
import { TaskStarterForm } from './TaskStarterForm'

interface FirstRunSheetProps {
  open: boolean
  onCreateTask: (title: string, estimatedMinutes: number) => Promise<Task>
  onStart: (taskId: string, mode: StudyMode) => Promise<boolean>
  onDismiss: () => void
  onComplete: () => void
}

export function FirstRunSheet({ open, onCreateTask, onStart, onDismiss, onComplete }: FirstRunSheetProps) {
  const [task, setTask] = useState<Task | null>(null)
  const [busy, setBusy] = useState(false)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    panel?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onDismiss()
      if (event.key !== 'Tab' || !panel) return
      const items = [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, onDismiss, open])

  if (!open) return null

  const start = async (mode: StudyMode) => {
    if (!task || busy) return
    setBusy(true)
    const started = await onStart(task.id, mode)
    setBusy(false)
    if (started) onComplete()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-[#17231dcc] px-0 pt-[max(1rem,env(safe-area-inset-top))] sm:items-center sm:justify-center sm:px-4" role="presentation">
      <section ref={panelRef} tabIndex={-1} className="surface drawer-enter pwa-keyboard-safe max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl p-5 outline-none sm:max-w-md sm:rounded-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="first-run-title">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Sprout size={21} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--accent-strong)]">欢迎来到 StudyBloom</p>
            <h2 id="first-run-title" className="mt-0.5 text-xl font-bold">{task ? '准备好就开始吧' : '今天先从一件小事开始'}</h2>
          </div>
          <button type="button" className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--muted)]" onClick={onDismiss} disabled={busy} aria-label="关闭首次使用引导"><X size={19} /></button>
        </div>

        {!task ? (
          <div className="mt-5">
            <p className="mb-4 text-sm leading-6 text-[var(--muted)]">写下今天最重要的一项任务，不需要先配置其他功能。</p>
            <TaskStarterForm autoFocus onCreate={onCreateTask} onCreated={setTask} submitLabel="创建并继续" />
            <button type="button" className="focus-ring mt-3 min-h-11 w-full rounded-xl text-sm font-semibold text-[var(--muted)]" onClick={onDismiss}>暂时跳过</button>
          </div>
        ) : (
          <div className="mt-5">
            <button type="button" className="focus-ring mb-3 flex min-h-11 items-center gap-2 rounded-xl pr-3 text-sm font-semibold text-[var(--muted)]" onClick={() => setTask(null)} disabled={busy}><ArrowLeft size={17} />返回修改</button>
            <div className="rounded-xl bg-[var(--accent-soft)] p-4">
              <p className="break-words font-bold">{task.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">预计 {task.estimatedMinutes ?? 25} 分钟</p>
            </div>
            <Button className="mt-4 w-full" loading={busy} icon={<Clock3 size={18} />} onClick={() => void start('pomodoro')}>开始 25 分钟专注</Button>
            <Button className="mt-2 w-full" variant="secondary" disabled={busy} onClick={() => void start('free')}>改用自由计时</Button>
            <button type="button" className="focus-ring mt-2 min-h-11 w-full rounded-xl text-sm font-semibold text-[var(--muted)]" onClick={onComplete} disabled={busy}>稍后开始</button>
          </div>
        )}
      </section>
    </div>
  )
}
