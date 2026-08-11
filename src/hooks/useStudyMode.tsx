import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as studyService from '../services/studySessions'
import type { StudySession, StudySessionSegment } from '../types'
import type { StartSessionInput } from '../services/studySessions'
import { getErrorMessage } from '../utils/errorMessage'

interface StudySessionContextValue {
  session: StudySession | null
  segments: StudySessionSegment[]
  loading: boolean
  error: string
  /** 1-second clock; re-derived durations must use database timestamps, this only refreshes the view. */
  nowMs: number
  /** Increments whenever a pomodoro phase finished (incl. while the page was away). */
  phaseEndSignal: number
  refresh: () => Promise<void>
  start: (input: StartSessionInput) => Promise<StudySession>
  pause: () => Promise<void>
  resume: () => Promise<void>
  finish: () => Promise<StudySession | null>
  startBreak: (phase: 'short_break' | 'long_break') => Promise<void>
  startNextFocus: () => Promise<void>
  skipBreak: () => Promise<void>
  endRound: () => Promise<void>
}

const StudySessionContext = createContext<StudySessionContextValue | null>(null)

export function StudySessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StudySession | null>(null)
  const [segments, setSegments] = useState<StudySessionSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [phaseEndSignal, setPhaseEndSignal] = useState(0)
  const sessionRef = useRef<StudySession | null>(null)
  const syncingRef = useRef(false)
  const loadedRef = useRef(false)

  useEffect(() => { sessionRef.current = session }, [session])

  const applySession = useCallback((next: StudySession | null, previous?: StudySession | null, caughtUpFocus = false) => {
    const prev = previous === undefined ? sessionRef.current : previous
    setSession(next)
    sessionRef.current = next
    const transitioned = prev && next && prev.id === next.id && prev.status === 'running' && next.status === 'waiting'
    if (transitioned || (caughtUpFocus && next && next.status === 'waiting')) {
      setPhaseEndSignal((value) => value + 1)
    }
  }, [])

  const refresh = useCallback(async (initial = false) => {
    if (syncingRef.current) return
    syncingRef.current = true
    if (initial) setLoading(true)
    try {
      const { session: next, caughtUpFocus } = await studyService.getActiveStudySession()
      const nextSegments = next ? await studyService.listSessionSegments(next.id) : []
      applySession(next, undefined, caughtUpFocus)
      setSegments(nextSegments)
      setError('')
    } catch (reason) {
      // Keep whatever we already show; never blank the page on a failed poll.
      if (!sessionRef.current) applySession(null)
      setError(getErrorMessage(reason, '读取学习状态失败'))
    } finally {
      syncingRef.current = false
      if (initial) { setLoading(false); loadedRef.current = true }
    }
  }, [applySession])

  useEffect(() => { void refresh(true) }, [refresh])

  // Recover after PWA backgrounded / screen unlocked / tab refocused.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible' && loadedRef.current) void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  // 1-second view tick + foreground catch-up when a phase end time passes.
  const activeSessionId = session?.id
  const activeStatus = session?.status
  const sessionEnded = session?.endedAt
  useEffect(() => {
    if (!activeSessionId || sessionEnded) return
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
      const current = sessionRef.current
      if (
        current
        && current.mode === 'pomodoro'
        && current.status === 'running'
        && current.phaseEndsAt
        && Date.now() >= Date.parse(current.phaseEndsAt)
        && !syncingRef.current
      ) {
        void refresh()
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [activeSessionId, activeStatus, sessionEnded, refresh])

  const reloadSegments = useCallback(async (next: StudySession) => {
    applySession(next)
    setSegments(await studyService.listSessionSegments(next.id))
  }, [applySession])

  const start = useCallback(async (input: StartSessionInput) => {
    const next = await studyService.startStudySession(input)
    await reloadSegments(next)
    return next
  }, [reloadSegments])

  const pause = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return
    await reloadSegments(await studyService.pauseStudySession(current.id))
  }, [reloadSegments])

  const resume = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return
    await reloadSegments(await studyService.resumeStudySession(current.id))
  }, [reloadSegments])

  const finish = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return null
    const next = await studyService.finishStudySession(current.id)
    applySession(null, next)
    setSegments([])
    return next
  }, [applySession])

  const startBreak = useCallback(async (phase: 'short_break' | 'long_break') => {
    const current = sessionRef.current
    if (!current) return
    await reloadSegments(await studyService.startNextPomodoroPhase(current.id, phase))
  }, [reloadSegments])

  const startNextFocus = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return
    await reloadSegments(await studyService.startNextPomodoroPhase(current.id, 'focus'))
  }, [reloadSegments])

  const skipBreak = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return
    await reloadSegments(await studyService.skipPomodoroBreak(current.id))
  }, [reloadSegments])

  const endRound = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return
    await reloadSegments(await studyService.endCurrentFocusRound(current.id))
  }, [reloadSegments])

  const value = useMemo(() => ({
    session, segments, loading, error, nowMs, phaseEndSignal,
    refresh, start, pause, resume, finish, startBreak, startNextFocus, skipBreak, endRound,
  }), [session, segments, loading, error, nowMs, phaseEndSignal, refresh, start, pause, resume, finish, startBreak, startNextFocus, skipBreak, endRound])

  return <StudySessionContext.Provider value={value}>{children}</StudySessionContext.Provider>
}

export function useStudyMode() {
  const value = useContext(StudySessionContext)
  if (!value) throw new Error('useStudyMode 必须在 StudySessionProvider 内使用')
  return value
}
