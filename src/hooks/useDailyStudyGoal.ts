import { useEffect, useState } from 'react'
import { fetchStudyDataForRange, getStudyPreferences } from '../services/studySessions'
import { todayDateKey } from '../utils/date'
import { calculateStudyStatistics } from '../utils/studyDuration'
import type { DateKey } from '../types'

interface HomeStudyState {
  loading: boolean
  enabled: boolean
  minutes: number
  studiedSeconds: number
  activeStudyDays: number
  countdownEnabled: boolean
  countdownTitle: string
  countdownDate: DateKey | null
}

export function useDailyStudyGoal(refreshKey: unknown = 0) {
  const [state, setState] = useState<HomeStudyState>({ loading: true, enabled: true, minutes: 120, studiedSeconds: 0, activeStudyDays: 0, countdownEnabled: false, countdownTitle: '考研初试', countdownDate: null })
  useEffect(() => {
    let active = true
    const today = todayDateKey()
    const monthStart = `${today.slice(0, 8)}01`
    Promise.allSettled([getStudyPreferences(), fetchStudyDataForRange(monthStart, today)])
      .then(([preferencesResult, dataResult]) => {
        if (!active) return
        const preferences = preferencesResult.status === 'fulfilled' ? preferencesResult.value : null
        const data = dataResult.status === 'fulfilled' ? dataResult.value : { sessions: [], segments: [] }
        const todayStats = calculateStudyStatistics(data.sessions, data.segments, { startDate: today, endDate: today })
        const monthStats = calculateStudyStatistics(data.sessions, data.segments, { startDate: monthStart, endDate: today })
        setState({
          loading: false,
          enabled: preferences?.dailyGoalEnabled ?? true,
          minutes: preferences?.dailyGoalMinutes ?? 120,
          studiedSeconds: todayStats.totalSeconds,
          activeStudyDays: monthStats.activeDays,
          countdownEnabled: preferences?.countdownEnabled ?? false,
          countdownTitle: preferences?.countdownTitle ?? '考研初试',
          countdownDate: preferences?.countdownDate ?? null,
        })
      })
    return () => { active = false }
  }, [refreshKey])
  return state
}
