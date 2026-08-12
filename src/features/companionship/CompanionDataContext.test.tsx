import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompanionHomeState } from '../../types'

const mocks = vi.hoisted(() => ({
  getCompanionHomeState: vi.fn(),
  sendCompanionFlower: vi.fn(),
}))

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'me@example.com' } }),
}))

vi.mock('../../services/companion', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../services/companion')>()
  return { ...original, ...mocks }
})

import { CompanionDataProvider } from './CompanionDataContext'
import { useCompanionHome } from '../../hooks/useCompanionHome'

const homeState: CompanionHomeState = {
  hasFriends: true,
  primaryCompanionId: 'friend-1',
  primaryCompanionName: '学习搭子',
  experienceMode: 'study_together',
  ownShareLevel: 'summary',
  companionShareLevel: 'summary',
  todayDate: '2026-08-13',
  companionToday: {
    date: '2026-08-13',
    effectiveStudy: true,
    studiedMinutes: 60,
    completedTasks: 1,
    totalTasks: 2,
  },
  sharedBloomDates: ['2026-08-13'],
  weekBloomDays: 1,
  sentToday: false,
  receivedToday: false,
  generatedAt: '2026-08-13T08:00:00Z',
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <CompanionDataProvider>{children}</CompanionDataProvider>
)

function HomeConsumer({ label }: { label: string }) {
  const home = useCompanionHome()
  return <span>{label}:{home.data?.primaryCompanionName ?? '加载中'}</span>
}

describe('CompanionDataProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCompanionHomeState.mockResolvedValue(homeState)
    mocks.sendCompanionFlower.mockResolvedValue(undefined)
  })

  it('deduplicates the home request shared by multiple consumers', async () => {
    render(
      <CompanionDataProvider>
        <HomeConsumer label="首页" />
        <HomeConsumer label="统计" />
      </CompanionDataProvider>,
    )

    expect(await screen.findByText('首页:学习搭子')).toBeInTheDocument()
    expect(screen.getByText('统计:学习搭子')).toBeInTheDocument()
    expect(mocks.getCompanionHomeState).toHaveBeenCalledTimes(1)
  })

  it('updates sentToday locally after sending a flower without reloading home', async () => {
    const { result } = renderHook(() => useCompanionHome(), { wrapper })
    await waitFor(() => expect(result.current.data?.primaryCompanionId).toBe('friend-1'))

    await act(async () => { await result.current.sendFlower() })

    expect(mocks.sendCompanionFlower).toHaveBeenCalledWith('friend-1')
    expect(result.current.data?.sentToday).toBe(true)
    expect(mocks.getCompanionHomeState).toHaveBeenCalledTimes(1)
  })
})
