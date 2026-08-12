import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getStudyPreferences: vi.fn(),
  fetchStudyDataForRange: vi.fn(),
}))

vi.mock('../services/studySessions', () => mocks)

import { useDailyStudyGoal } from './useDailyStudyGoal'

describe('useDailyStudyGoal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps the saved countdown visible when study statistics fail', async () => {
    mocks.getStudyPreferences.mockResolvedValue({
      dailyGoalEnabled: true,
      dailyGoalMinutes: 120,
      countdownEnabled: true,
      countdownTitle: '考研初试',
      countdownDate: '2026-12-20',
    })
    mocks.fetchStudyDataForRange.mockRejectedValue(new Error('统计读取失败'))

    const { result } = renderHook(() => useDailyStudyGoal())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.countdownEnabled).toBe(true)
    expect(result.current.countdownDate).toBe('2026-12-20')
    expect(result.current.studiedSeconds).toBe(0)
  })
})
