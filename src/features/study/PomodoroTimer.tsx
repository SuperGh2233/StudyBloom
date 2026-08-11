import { Coffee, Flag, Hourglass, Pause, Play, SkipForward, Square } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { Input } from '../../components/FormField'
import type { StartSessionInput } from '../../services/studySessions'
import { POMODORO_LIMITS, type StudyPreferences, type StudyPreferencesUpdate, type StudySession, type StudySessionSegment } from '../../types'
import { formatClockHMS, formatClockMS, nextBreakPhase, phaseRemainingSeconds, sessionElapsedSeconds } from '../../utils/studyDuration'

interface PomodoroTimerProps {
  session: StudySession | null
  segments: StudySessionSegment[]
  nowMs: number
  prefs: StudyPreferences
  taskId: string | null
  busy: string
  onStart: (input: StartSessionInput) => void
  onPause: () => void
  onResume: () => void
  onFinish: () => void
  onStartBreak: (phase: 'short_break' | 'long_break') => void
  onSkipBreak: () => void
  onStartNextFocus: () => void
  onEndRound: () => void
  /** Persists in the parent; rejects after its own error toast so the draft can revert. */
  onPrefsSave: (update: StudyPreferencesUpdate) => Promise<void>
}

export function PomodoroTimer(props: PomodoroTimerProps) {
  if (props.session) return <ActivePomodoro {...props} session={props.session} />
  return <PomodoroConfig {...props} />
}

// ---------------------------------------------------------------------------
// Live session card
// ---------------------------------------------------------------------------

function ActivePomodoro({ session, segments, nowMs, busy, onPause, onResume, onFinish, onStartBreak, onSkipBreak, onStartNextFocus, onEndRound }: PomodoroTimerProps & { session: StudySession }) {
  const acting = busy !== ''
  const onBreak = session.currentPhase === 'short_break' || session.currentPhase === 'long_break'
  const waiting = session.status === 'waiting'
  const paused = session.status === 'paused'
  const nextBreak = nextBreakPhase(session.pomodoroCompletedRounds, session.pomodoroRoundsBeforeLongBreak ?? POMODORO_LIMITS.roundsBeforeLongBreak.fallback)

  const statusText = waiting
    ? (onBreak ? '休息结束' : `第 ${session.currentRound} 轮专注已完成`)
    : onBreak
      ? (session.currentPhase === 'short_break' ? '短休息' : '长休息')
      : `第 ${session.currentRound} 轮专注${paused ? ' · 已暂停' : ''}`

  // waiting 状态下没有进行中的阶段，显示本次学习累计时长。
  const clock = waiting
    ? formatClockHMS(sessionElapsedSeconds(session, segments, nowMs))
    : formatClockMS(phaseRemainingSeconds(session, nowMs))

  return (
    <section className="surface rounded-2xl p-5" aria-label="番茄专注进行中">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold">番茄专注</h2>
          <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{session.taskTitleSnapshot.trim() || '自由学习'}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${!waiting && !paused ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'bg-[var(--surface-soft)] text-[var(--muted)]'}`}>{statusText}</span>
      </div>
      <p className="mt-6 text-center text-5xl font-bold tabular-nums tracking-tight sm:text-6xl">{clock}</p>
      <p className="mt-3 text-center text-xs text-[var(--muted)]">已完成 {session.pomodoroCompletedRounds} 轮{onBreak && !waiting ? ' · 离开屏幕放松一下眼睛' : ''}</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {waiting ? (
          onBreak ? (
            <>
              <Button icon={<Play size={18} />} loading={busy === 'next'} disabled={acting} onClick={onStartNextFocus} aria-label="开始下一轮专注">开始下一轮</Button>
              <Button variant="secondary" icon={<Square size={16} />} loading={busy === 'finish'} disabled={acting} onClick={onFinish} aria-label="结束本次学习">结束本次学习</Button>
            </>
          ) : (
            <>
              <Button icon={<Coffee size={18} />} loading={busy === 'break'} disabled={acting} onClick={() => onStartBreak(nextBreak)} aria-label={nextBreak === 'long_break' ? '开始长休息' : '开始短休息'}>{nextBreak === 'long_break' ? '开始长休息' : '开始短休息'}</Button>
              <Button variant="secondary" icon={<SkipForward size={18} />} loading={busy === 'skip'} disabled={acting} onClick={onSkipBreak} aria-label="跳过休息">跳过休息</Button>
            </>
          )
        ) : onBreak ? (
          <Button variant="secondary" className="col-span-2" icon={<SkipForward size={18} />} loading={busy === 'skip'} disabled={acting} onClick={onSkipBreak} aria-label="跳过休息">跳过休息</Button>
        ) : (
          <>
            {paused
              ? <Button icon={<Play size={18} />} loading={busy === 'resume'} disabled={acting} onClick={onResume} aria-label="继续专注">继续</Button>
              : <Button variant="secondary" icon={<Pause size={18} />} loading={busy === 'pause'} disabled={acting} onClick={onPause} aria-label="暂停专注">暂停</Button>}
            <Button variant="secondary" icon={<Flag size={16} />} loading={busy === 'round'} disabled={acting} onClick={onEndRound} aria-label="提前结束本轮">提前结束本轮</Button>
            <Button variant="secondary" className="col-span-2" icon={<Square size={16} />} loading={busy === 'finish'} disabled={acting} onClick={onFinish} aria-label="结束本次学习">结束本次学习</Button>
          </>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Config card (only rendered when no session is active)
// ---------------------------------------------------------------------------

type DraftKey = 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'rounds'
type Draft = Record<DraftKey, string>

const draftFromPrefs = (prefs: StudyPreferences): Draft => ({
  focusMinutes: String(Math.round(prefs.focusSeconds / 60)),
  shortBreakMinutes: String(Math.round(prefs.shortBreakSeconds / 60)),
  longBreakMinutes: String(Math.round(prefs.longBreakSeconds / 60)),
  rounds: String(prefs.roundsBeforeLongBreak),
})

const DRAFT_LIMITS: Record<DraftKey, { min: number; max: number }> = {
  focusMinutes: { min: POMODORO_LIMITS.focusSeconds.min / 60, max: POMODORO_LIMITS.focusSeconds.max / 60 },
  shortBreakMinutes: { min: POMODORO_LIMITS.shortBreakSeconds.min / 60, max: POMODORO_LIMITS.shortBreakSeconds.max / 60 },
  longBreakMinutes: { min: POMODORO_LIMITS.longBreakSeconds.min / 60, max: POMODORO_LIMITS.longBreakSeconds.max / 60 },
  rounds: { min: POMODORO_LIMITS.roundsBeforeLongBreak.min, max: POMODORO_LIMITS.roundsBeforeLongBreak.max },
}

const FIELDS: { key: DraftKey; label: string; hint: string }[] = [
  { key: 'focusMinutes', label: '专注时长（分钟）', hint: '15–90 分钟' },
  { key: 'shortBreakMinutes', label: '短休息（分钟）', hint: '3–30 分钟' },
  { key: 'longBreakMinutes', label: '长休息（分钟）', hint: '10–60 分钟' },
  { key: 'rounds', label: '长休息间隔（轮）', hint: '2–8 轮' },
]

function PomodoroConfig({ prefs, taskId, busy, onStart, onPrefsSave }: PomodoroTimerProps) {
  const [draft, setDraft] = useState<Draft>(() => draftFromPrefs(prefs))
  useEffect(() => { setDraft(draftFromPrefs(prefs)) }, [prefs])
  const acting = busy !== ''

  const persist = (update: StudyPreferencesUpdate) => {
    void onPrefsSave(update).catch(() => setDraft(draftFromPrefs(prefs)))
  }

  const commit = (key: DraftKey, raw: string) => {
    const limit = DRAFT_LIMITS[key]
    const parsed = Math.round(Number(raw))
    const value = Number.isFinite(parsed) ? Math.min(limit.max, Math.max(limit.min, parsed)) : Number(draftFromPrefs(prefs)[key])
    setDraft((current) => ({ ...current, [key]: String(value) }))
    const update: StudyPreferencesUpdate =
      key === 'focusMinutes' ? { focusSeconds: value * 60 }
      : key === 'shortBreakMinutes' ? { shortBreakSeconds: value * 60 }
      : key === 'longBreakMinutes' ? { longBreakSeconds: value * 60 }
      : { roundsBeforeLongBreak: value }
    const unchanged =
      (key === 'focusMinutes' && prefs.focusSeconds === value * 60)
      || (key === 'shortBreakMinutes' && prefs.shortBreakSeconds === value * 60)
      || (key === 'longBreakMinutes' && prefs.longBreakSeconds === value * 60)
      || (key === 'rounds' && prefs.roundsBeforeLongBreak === value)
    if (!unchanged) persist(update)
  }

  const applyPreset = (focusMinutes: number, shortBreakMinutes: number) => {
    setDraft((current) => ({ ...current, focusMinutes: String(focusMinutes), shortBreakMinutes: String(shortBreakMinutes) }))
    const update: StudyPreferencesUpdate = {}
    if (prefs.focusSeconds !== focusMinutes * 60) update.focusSeconds = focusMinutes * 60
    if (prefs.shortBreakSeconds !== shortBreakMinutes * 60) update.shortBreakSeconds = shortBreakMinutes * 60
    if (update.focusSeconds !== undefined || update.shortBreakSeconds !== undefined) persist(update)
  }

  // 直接从当前输入值（按范围收敛）启动，避免异步保存未落地时读到旧偏好。
  const clampedDraftValue = (key: DraftKey): number => {
    const limit = DRAFT_LIMITS[key]
    const parsed = Math.round(Number(draft[key]))
    return Number.isFinite(parsed) ? Math.min(limit.max, Math.max(limit.min, parsed)) : Number(draftFromPrefs(prefs)[key])
  }
  const startFromDraft = () => onStart({
    mode: 'pomodoro',
    taskId,
    focusSeconds: clampedDraftValue('focusMinutes') * 60,
    shortBreakSeconds: clampedDraftValue('shortBreakMinutes') * 60,
    longBreakSeconds: clampedDraftValue('longBreakMinutes') * 60,
    roundsBeforeLongBreak: clampedDraftValue('rounds'),
  })

  return (
    <section className="surface rounded-2xl p-5" aria-label="番茄专注设置">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--rose-soft)] text-[var(--rose)]"><Hourglass size={21} strokeWidth={1.8} /></span>
        <div className="min-w-0">
          <h2 className="font-bold">番茄专注</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">专注与休息交替进行，长休息自动安排。</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={acting} onClick={() => applyPreset(25, 5)} aria-label="使用标准专注预设：25 分钟专注加 5 分钟休息">标准专注 25+5</Button>
        <Button variant="secondary" disabled={acting} onClick={() => applyPreset(50, 10)} aria-label="使用深度学习预设：50 分钟专注加 10 分钟休息">深度学习 50+10</Button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {FIELDS.map((field) => (
          <Input
            key={field.key}
            name={`pomodoro-${field.key}`}
            label={field.label}
            hint={field.hint}
            type="number"
            inputMode="numeric"
            min={DRAFT_LIMITS[field.key].min}
            max={DRAFT_LIMITS[field.key].max}
            step={1}
            value={draft[field.key]}
            disabled={acting}
            onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
            onBlur={(event) => commit(field.key, event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
          />
        ))}
      </div>

      <Button
        className="mt-5 w-full"
        icon={<Play size={18} />}
        loading={busy === 'start'}
        disabled={acting}
        onClick={startFromDraft}
      >开始番茄专注</Button>
    </section>
  )
}
