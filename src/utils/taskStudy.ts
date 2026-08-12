import type { StudySession, StudySessionSegment, TaskStudySummary } from '../types'
import { sessionElapsedSeconds } from './studyDuration'

export function calculateTaskStudySummaries(
  sessions: StudySession[],
  segments: StudySessionSegment[],
  nowMs: number = Date.now(),
): Map<string, TaskStudySummary> {
  const summaries = new Map<string, TaskStudySummary>()
  for (const session of sessions) {
    if (!session.taskId) continue
    const seconds = sessionElapsedSeconds(session, segments, nowMs)
    const previous = summaries.get(session.taskId) ?? { taskId: session.taskId, totalSeconds: 0, sessionCount: 0, lastStudiedAt: null }
    previous.totalSeconds += seconds
    if (seconds > 0) {
      previous.sessionCount += 1
      const studiedAt = session.endedAt ?? session.startedAt
      if (!previous.lastStudiedAt || Date.parse(studiedAt) > Date.parse(previous.lastStudiedAt)) previous.lastStudiedAt = studiedAt
    }
    summaries.set(session.taskId, previous)
  }
  return summaries
}
