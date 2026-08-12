import { useEffect, useMemo, useState } from 'react'
import { fetchStudyDataForTasks } from '../services/studySessions'
import type { TaskStudySummary } from '../types'
import { calculateTaskStudySummaries } from '../utils/taskStudy'

export function useTaskStudySummaries(taskIds: string[], refreshKey: unknown = 0) {
  const key = useMemo(() => [...new Set(taskIds)].sort().join(','), [taskIds])
  const [summaries, setSummaries] = useState<Map<string, TaskStudySummary>>(() => new Map())

  useEffect(() => {
    let active = true
    const ids = key ? key.split(',') : []
    if (!ids.length) { setSummaries(new Map()); return }
    fetchStudyDataForTasks(ids)
      .then(({ sessions, segments }) => { if (active) setSummaries(calculateTaskStudySummaries(sessions, segments)) })
      .catch(() => { if (active) setSummaries(new Map()) })
    return () => { active = false }
  }, [key, refreshKey])

  return summaries
}
