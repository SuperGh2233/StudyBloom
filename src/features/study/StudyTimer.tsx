import { Pause, Play, Square, Timer } from 'lucide-react'
import { Button } from '../../components/Button'
import type { StartSessionInput } from '../../services/studySessions'
import type { StudySession, StudySessionSegment } from '../../types'
import { formatClockHMS, sessionElapsedSeconds } from '../../utils/studyDuration'

interface StudyTimerProps {
  session: StudySession | null
  segments: StudySessionSegment[]
  nowMs: number
  taskId: string | null
  busy: string
  online: boolean
  onStart: (input: StartSessionInput) => void
  onPause: () => void
  onResume: () => void
  onFinish: () => void
}

/** Free-timing card: start screen when idle, live elapsed clock when running. */
export function StudyTimer({ session, segments, nowMs, taskId, busy, online, onStart, onPause, onResume, onFinish }: StudyTimerProps) {
  const acting = busy !== '' || !online

  if (!session) {
    return (
      <section className="surface rounded-2xl p-5" aria-label="自由计时">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Timer size={21} strokeWidth={1.8} /></span>
          <div className="min-w-0">
            <h2 className="font-bold">自由计时</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">随时开始，按自己的节奏学习。</p>
          </div>
        </div>
        <Button className="mt-5 w-full" icon={<Play size={18} />} loading={busy === 'start'} disabled={acting} onClick={() => onStart({ mode: 'free', taskId })}>开始计时</Button>
      </section>
    )
  }

  const paused = session.status === 'paused'
  return (
    <section className="surface rounded-2xl p-5" aria-label="自由计时进行中">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold">自由计时</h2>
          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{session.taskTitleSnapshot.trim() || '自由学习'}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${paused ? 'bg-[var(--surface-soft)] text-[var(--muted)]' : 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'}`}>{paused ? '已暂停' : '学习中'}</span>
      </div>
      <p className="mt-6 text-center text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">{formatClockHMS(sessionElapsedSeconds(session, segments, nowMs))}</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {paused
          ? <Button icon={<Play size={18} />} loading={busy === 'resume'} disabled={acting} onClick={onResume} aria-label="继续学习">继续</Button>
          : <Button variant="secondary" icon={<Pause size={18} />} loading={busy === 'pause'} disabled={acting} onClick={onPause} aria-label="暂停学习">暂停</Button>}
        <Button variant="secondary" icon={<Square size={16} />} loading={busy === 'finish'} disabled={acting} onClick={onFinish} aria-label="结束本次学习">结束本次学习</Button>
      </div>
    </section>
  )
}
