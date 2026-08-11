import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Clock, Hourglass, RefreshCw, Timer } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { LoadingState } from '../components/LoadingState'
import { useToast } from '../components/ToastProvider'
import { AttendanceCard } from '../features/study/AttendanceCard'
import { PomodoroTimer } from '../features/study/PomodoroTimer'
import { StudyRecords } from '../features/study/StudyRecords'
import { StudyTimer } from '../features/study/StudyTimer'
import { TaskPicker } from '../features/study/TaskPicker'
import { useAttendance } from '../hooks/useAttendance'
import { useStudyMode } from '../hooks/useStudyMode'
import { listAttendanceRecordsByDate } from '../services/attendance'
import {
  defaultStudyPreferences,
  fetchStudyDataForRange,
  getStudyPreferences,
  saveStudyPreferences,
  type StartSessionInput,
} from '../services/studySessions'
import { setTaskCompleted } from '../services/tasks'
import type {
  AttendanceRecord,
  StudyMode,
  StudyPreferences,
  StudyPreferencesUpdate,
  StudySession,
  StudySessionSegment,
} from '../types'
import { todayDateKey } from '../utils/date'
import { getErrorMessage } from '../utils/errorMessage'
import { calculateStudyStatistics, formatDurationHuman } from '../utils/studyDuration'

/** 880Hz / 0.15s / gain 0.08 soft beep; AudioContext is created lazily per call. */
function playPhaseEndBeep() {
  try {
    const AudioContextCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return
    const context = new AudioContextCtor()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gain.gain.value = 0.08
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.15)
    oscillator.onended = () => { void context.close() }
  } catch {
    // 音频不可用时静默跳过。
  }
}

/** 1s clock used when no study session is active (the study hook only ticks then). */
function useNowTick(enabled: boolean) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    setNowMs(Date.now())
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [enabled])
  return nowMs
}

const modeButtonClass = (selected: boolean) =>
  `focus-ring flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${selected ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]'}`

export function StudyPage() {
  const study = useStudyMode()
  const attendance = useAttendance()
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()

  const [prefs, setPrefs] = useState<StudyPreferences>(() => defaultStudyPreferences(''))
  const [mode, setMode] = useState<StudyMode>('free')
  const [taskId, setTaskId] = useState<string | null>(() => searchParams.get('task'))
  const [busy, setBusy] = useState('')
  const [taskDialog, setTaskDialog] = useState<StudySession | null>(null)
  const [recordsVersion, setRecordsVersion] = useState(0)
  const [todayData, setTodayData] = useState<{ sessions: StudySession[]; segments: StudySessionSegment[] }>({ sessions: [], segments: [] })
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([])
  const [todayLoading, setTodayLoading] = useState(true)

  const busyRef = useRef(false)
  const modeTouched = useRef(false)
  const prefsRef = useRef(prefs)
  useEffect(() => { prefsRef.current = prefs }, [prefs])

  // 载入云端番茄偏好；默认值兜底，未保存过不写库。
  useEffect(() => {
    let active = true
    getStudyPreferences()
      .then((saved) => {
        if (!active || !saved) return
        setPrefs(saved)
        if (!modeTouched.current) setMode(saved.defaultMode)
      })
      .catch(() => { /* 保留本地默认偏好 */ })
    return () => { active = false }
  }, [])

  // 今日记录（会话 + 片段 + 当日签到），任何学习/签到变化后 bump 重取。
  useEffect(() => {
    let active = true
    setTodayLoading(true)
    const today = todayDateKey()
    Promise.all([fetchStudyDataForRange(today, today), listAttendanceRecordsByDate(today)])
      .then(([studyData, attendanceRows]) => {
        if (!active) return
        setTodayData(studyData)
        setTodayAttendance(attendanceRows)
      })
      .catch((reason) => { if (active) showToast(getErrorMessage(reason, '读取学习记录失败'), 'error') })
      .finally(() => { if (active) setTodayLoading(false) })
    return () => { active = false }
  }, [recordsVersion, showToast])

  // 番茄阶段结束提醒：toast + 可选震动/提示音。休息结束与专注结束文案不同。
  // lastSignal 防止 study.session 变化（依赖项）导致同一次提醒重复触发。
  const lastSignal = useRef(0)
  useEffect(() => {
    if (!study.phaseEndSignal || study.phaseEndSignal === lastSignal.current) return
    lastSignal.current = study.phaseEndSignal
    const phase = study.session?.currentPhase
    const breakEnded = phase === 'short_break' || phase === 'long_break'
    showToast(breakEnded ? '休息已结束，可以开始下一轮了。' : '本轮专注已完成，休息一下吧。')
    const current = prefsRef.current
    if (current.vibrationEnabled) {
      try { navigator.vibrate?.([200, 100, 200]) } catch { /* 不支持震动 */ }
    }
    if (current.soundEnabled) playPhaseEndBeep()
  }, [study.phaseEndSignal, study.session, showToast])

  const bump = useCallback(() => setRecordsVersion((version) => version + 1), [])

  const run = useCallback(async (key: string, action: () => Promise<void>, success?: string) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(key)
    try {
      await action()
      if (success) showToast(success)
    } catch (reason) {
      showToast(getErrorMessage(reason, '操作失败'), 'error')
    } finally {
      busyRef.current = false
      setBusy('')
    }
  }, [showToast])

  const persistPrefs = useCallback(async (update: StudyPreferencesUpdate) => {
    try {
      const saved = await saveStudyPreferences(update)
      setPrefs(saved)
      showToast('番茄设置已保存')
    } catch (reason) {
      showToast(getErrorMessage(reason, '保存设置失败'), 'error')
      throw reason
    }
  }, [showToast])

  const handleStart = (input: StartSessionInput) => void run('start', async () => { await study.start(input); bump() }, '学习已开始')
  const handlePause = () => void run('pause', async () => { await study.pause(); bump() })
  const handleResume = () => void run('resume', async () => { await study.resume(); bump() })
  const handleFinish = () => void run('finish', async () => {
    const final = await study.finish()
    bump()
    if (final && final.taskId) setTaskDialog(final)
  })
  const handleStartBreak = (phase: 'short_break' | 'long_break') => void run('break', async () => { await study.startBreak(phase); bump() })
  const handleSkipBreak = () => void run('skip', async () => { await study.skipBreak(); bump() })
  const handleNextFocus = () => void run('next', async () => { await study.startNextFocus(); bump() })
  const handleEndRound = () => void run('round', async () => { await study.endRound(); bump() })

  const completeLinkedTask = () => void run('task-complete', async () => {
    if (!taskDialog?.taskId) return
    await setTaskCompleted(taskDialog.taskId, true)
    setTaskDialog(null)
  }, '任务已标记完成')

  // 在场时长只在「无学习会话但有未签退记录」时需要本地秒针（会话激活时 study.nowMs 已在跳动）。
  const presenceTickMs = useNowTick(!study.session && Boolean(attendance.openRecord))
  const nowMs = study.session ? study.nowMs : presenceTickMs
  const today = todayDateKey()
  const todayStats = useMemo(
    () => calculateStudyStatistics(todayData.sessions, todayData.segments, { startDate: today, endDate: today }, nowMs),
    [todayData, today, nowMs],
  )

  const timerProps = {
    segments: study.segments,
    nowMs: study.nowMs,
    taskId,
    busy,
    onStart: handleStart,
    onPause: handlePause,
    onResume: handleResume,
    onFinish: handleFinish,
  }

  const timerSlot = study.session ? (
    study.session.mode === 'free'
      ? <StudyTimer session={study.session} {...timerProps} />
      : (
        <PomodoroTimer
          session={study.session}
          {...timerProps}
          prefs={prefs}
          onStartBreak={handleStartBreak}
          onSkipBreak={handleSkipBreak}
          onStartNextFocus={handleNextFocus}
          onEndRound={handleEndRound}
          onPrefsSave={persistPrefs}
        />
      )
  ) : study.loading ? (
    <div className="surface rounded-2xl p-5"><LoadingState label="正在读取学习状态..." /></div>
  ) : (
    <>
      {mode === 'free'
        ? <StudyTimer session={null} {...timerProps} />
        : (
          <PomodoroTimer
            session={null}
            {...timerProps}
            prefs={prefs}
            onStartBreak={handleStartBreak}
            onSkipBreak={handleSkipBreak}
            onStartNextFocus={handleNextFocus}
            onEndRound={handleEndRound}
            onPrefsSave={persistPrefs}
          />
        )}
      <div className="surface rounded-2xl p-3">
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="选择学习模式">
          <button type="button" aria-pressed={mode === 'free'} className={modeButtonClass(mode === 'free')} onClick={() => { modeTouched.current = true; setMode('free') }}>
            <Timer size={18} strokeWidth={1.9} aria-hidden="true" />自由计时
          </button>
          <button type="button" aria-pressed={mode === 'pomodoro'} className={modeButtonClass(mode === 'pomodoro')} onClick={() => { modeTouched.current = true; setMode('pomodoro') }}>
            <Hourglass size={18} strokeWidth={1.9} aria-hidden="true" />番茄专注
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div className="gentle-enter mx-auto max-w-5xl">
      <header className="mb-5">
        <p className="text-sm font-semibold text-[var(--accent-strong)]">学习</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">专注一会儿</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{format(new Date(), 'M月d日 EEEE', { locale: zhCN })} · 慢慢来，比较快。</p>
      </header>

      <section className="surface rounded-2xl p-5" aria-label="今日学习概览">
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 rounded-xl bg-[var(--accent-soft)] p-4">
            <Clock size={19} className="text-[var(--accent-strong)]" aria-hidden="true" />
            <strong className="mt-3 block text-xl leading-7">{formatDurationHuman(todayStats.totalSeconds)}</strong>
            <span className="text-xs text-[var(--muted)]">今日学习时长</span>
          </div>
          <div className="min-w-0 rounded-xl bg-[var(--rose-soft)] p-4">
            <Hourglass size={19} className="text-[var(--rose)]" aria-hidden="true" />
            <strong className="mt-3 block text-xl leading-7">{todayStats.completedPomodoroRounds}</strong>
            <span className="text-xs text-[var(--muted)]">完成番茄轮数</span>
          </div>
        </div>
      </section>

      {study.error && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--rose-soft)] p-4 text-sm text-[var(--rose)]">
          <span className="min-w-0">{study.error}</span>
          <Button variant="secondary" className="shrink-0" icon={<RefreshCw size={16} />} onClick={() => void study.refresh()} aria-label="重试读取学习状态">重试</Button>
        </div>
      )}

      <div className="mt-5 grid min-w-0 items-start gap-5 md:grid-cols-2">
        <div className="grid min-w-0 gap-5">
          {timerSlot}
          <TaskPicker taskId={taskId} onTaskChange={setTaskId} sessions={todayData.sessions} segments={todayData.segments} nowMs={nowMs} />
        </div>
        <div className="grid min-w-0 gap-5">
          <AttendanceCard
            locations={attendance.locations}
            openRecord={attendance.openRecord}
            loading={attendance.loading}
            error={attendance.error}
            nowMs={nowMs}
            onReload={() => void attendance.reload()}
            onCheckIn={attendance.checkIn}
            onCheckOut={attendance.checkOut}
            onForceClose={attendance.forceClose}
            onChanged={bump}
          />
          <StudyRecords
            sessions={todayData.sessions}
            segments={todayData.segments}
            todayAttendance={todayAttendance}
            recentRecords={attendance.recentRecords}
            locations={attendance.locations}
            nowMs={nowMs}
            loading={todayLoading}
          />
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(taskDialog)}
        title={taskDialog?.mode === 'pomodoro' ? `本次已完成 ${taskDialog?.pomodoroCompletedRounds ?? 0} 轮专注` : '本次学习已结束'}
        description={taskDialog?.mode === 'pomodoro'
          ? `是否同时完成「${taskDialog?.taskTitleSnapshot ?? ''}」？`
          : `是否同时将「${taskDialog?.taskTitleSnapshot ?? ''}」标记为已完成？`}
        confirmLabel="完成任务"
        cancelLabel="暂不完成"
        loading={busy === 'task-complete'}
        onClose={() => setTaskDialog(null)}
        onConfirm={completeLinkedTask}
      />
    </div>
  )
}
