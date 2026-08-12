import { act, renderHook, waitFor } from '@testing-library/react'
import { type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudySession } from '../types'

const mocks = vi.hoisted(() => ({
  getActiveStudySession: vi.fn(),
  listSessionSegments: vi.fn(),
  startStudySession: vi.fn(),
}))

vi.mock('../services/studySessions', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/studySessions')>()
  return { ...original, ...mocks }
})

import { StudySessionProvider, useStudyMode } from './useStudyMode'

const session = {
  id: 'session-1', userId: 'u1', taskId: 'task-1', taskTitleSnapshot: '英语单词', attendanceRecordId: null,
  planDate: '2026-08-12', mode: 'pomodoro', status: 'running', startedAt: '2026-08-12T00:00:00Z', endedAt: null,
  pomodoroFocusSeconds: 1500, pomodoroShortBreakSeconds: 300, pomodoroLongBreakSeconds: 900,
  pomodoroRoundsBeforeLongBreak: 4, pomodoroCompletedRounds: 0, currentPhase: 'focus', currentRound: 1,
  phaseStartedAt: '2026-08-12T00:00:00Z', phaseEndsAt: '2026-08-12T00:25:00Z', phaseRemainingSeconds: null,
  reflection: '', createdAt: '', updatedAt: '',
} as StudySession

describe('StudySessionProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getActiveStudySession.mockResolvedValue({ session: null, caughtUpFocus: false })
    mocks.listSessionSegments.mockResolvedValue([])
  })

  it('shares one start request across consecutive clicks', async () => {
    let resolve!: (value: StudySession) => void
    mocks.startStudySession.mockReturnValue(new Promise<StudySession>((done) => { resolve = done }))
    const wrapper = ({ children }: { children: ReactNode }) => <StudySessionProvider>{children}</StudySessionProvider>
    const { result } = renderHook(() => useStudyMode(), { wrapper })
    await waitFor(() => expect(result.current.loading).toBe(false))

    let first!: Promise<StudySession>
    let second!: Promise<StudySession>
    act(() => {
      first = result.current.start({ mode: 'pomodoro', taskId: 'task-1' })
      second = result.current.start({ mode: 'pomodoro', taskId: 'task-1' })
    })
    expect(first).toBe(second)
    expect(mocks.startStudySession).toHaveBeenCalledTimes(1)
    resolve(session)
    await act(async () => { await first })
  })
})
