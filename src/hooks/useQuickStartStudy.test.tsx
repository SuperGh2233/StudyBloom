import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudySession } from '../types'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  showToast: vi.fn(),
  getStudyPreferences: vi.fn(),
  study: {
    session: null as StudySession | null,
    refresh: vi.fn(),
    resume: vi.fn(),
    start: vi.fn(),
  },
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('../components/ToastProvider', () => ({ useToast: () => ({ showToast: mocks.showToast }) }))
vi.mock('./useNetworkStatus', () => ({ useNetworkStatus: () => true }))
vi.mock('./useStudyMode', () => ({ useStudyMode: () => mocks.study }))
vi.mock('../services/studySessions', () => ({ getStudyPreferences: mocks.getStudyPreferences }))

import { useQuickStartStudy } from './useQuickStartStudy'

const activeSession = { id: 'session-1', status: 'running', taskId: 'task-1' } as StudySession

describe('useQuickStartStudy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.study.session = null
    mocks.study.refresh.mockResolvedValue(null)
    mocks.study.start.mockResolvedValue(activeSession)
    mocks.getStudyPreferences.mockResolvedValue(null)
  })

  it('opens an existing active session without creating another one', async () => {
    mocks.study.session = activeSession
    const { result } = renderHook(() => useQuickStartStudy())

    await act(async () => { expect(await result.current.start('task-2')).toBe(true) })

    expect(mocks.study.start).not.toHaveBeenCalled()
    expect(mocks.navigate).toHaveBeenCalledWith('/study')
  })

  it('ignores a second click while the first start request is pending', async () => {
    let release!: (value: StudySession) => void
    mocks.study.start.mockReturnValue(new Promise<StudySession>((resolve) => { release = resolve }))
    const { result } = renderHook(() => useQuickStartStudy())

    let first!: Promise<boolean>
    let second!: Promise<boolean>
    act(() => {
      first = result.current.start('task-1')
      second = result.current.start('task-1')
    })
    await expect(second).resolves.toBe(false)
    await act(async () => { release(activeSession); await first })

    expect(mocks.study.start).toHaveBeenCalledTimes(1)
  })
})
