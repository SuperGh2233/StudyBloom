import { useEffect, useState } from 'react'
import { fetchStudyDataForRange, getStudyPreferences } from '../services/studySessions'
import { todayDateKey } from '../utils/date'
import { calculateStudyStatistics } from '../utils/studyDuration'

export function useDailyStudyGoal(refreshKey: unknown = 0) {
  const [state, setState] = useState({ loading: true, enabled: true, minutes: 120, studiedSeconds: 0 })
  useEffect(() => {
    let active = true
    const today = todayDateKey()
    Promise.all([getStudyPreferences(), fetchStudyDataForRange(today, today)])
      .then(([preferences, data]) => {
        if (!active) return
        setState({
          loading: false,
          enabled: preferences?.dailyGoalEnabled ?? true,
          minutes: preferences?.dailyGoalMinutes ?? 120,
          studiedSeconds: calculateStudyStatistics(data.sessions, data.segments, { startDate: today, endDate: today }).totalSeconds,
        })
      })
      .catch(() => { if (active) setState((current) => ({ ...current, loading: false })) })
    return () => { active = false }
  }, [refreshKey])
  return state
}
