import { describe, expect, it } from 'vitest'
import type { StudySession, StudySessionSegment } from '../types'
import { calculateTaskStudySummaries } from './taskStudy'

const session = (id: string, taskId: string | null, startedAt: string, endedAt: string): StudySession => ({
  id, userId: 'user', taskId, taskTitleSnapshot: taskId ? '英语阅读' : '', attendanceRecordId: null,
  planDate: '2026-08-12', mode: 'free', status: 'completed', startedAt, endedAt,
  pomodoroFocusSeconds: null, pomodoroShortBreakSeconds: null, pomodoroLongBreakSeconds: null,
  pomodoroRoundsBeforeLongBreak: null, pomodoroCompletedRounds: 0, currentPhase: null,
  currentRound: 0, phaseStartedAt: null, phaseEndsAt: null, phaseRemainingSeconds: null,
  reflection: '', createdAt: startedAt, updatedAt: endedAt,
})

const segment = (id: string, sessionId: string, startedAt: string, endedAt: string): StudySessionSegment => ({
  id, userId: 'user', sessionId, segmentKind: 'free', pomodoroRound: null,
  pomodoroCompletedAt: null, startedAt, endedAt, createdAt: startedAt,
})

describe('任务学习汇总', () => {
  it('累计同一任务的多次学习时长、次数和最近时间', () => {
    const sessions = [
      session('s1', 'task-1', '2026-08-11T01:00:00Z', '2026-08-11T01:30:00Z'),
      session('s2', 'task-1', '2026-08-12T01:00:00Z', '2026-08-12T01:45:00Z'),
    ]
    const segments = [
      segment('g1', 's1', '2026-08-11T01:00:00Z', '2026-08-11T01:30:00Z'),
      segment('g2', 's2', '2026-08-12T01:00:00Z', '2026-08-12T01:45:00Z'),
    ]
    expect(calculateTaskStudySummaries(sessions, segments).get('task-1')).toEqual({
      taskId: 'task-1', totalSeconds: 4500, sessionCount: 2, lastStudiedAt: '2026-08-12T01:45:00Z',
    })
  })

  it('忽略自由学习和没有有效片段的会话次数', () => {
    const sessions = [
      session('free', null, '2026-08-12T01:00:00Z', '2026-08-12T01:20:00Z'),
      session('empty', 'task-1', '2026-08-12T02:00:00Z', '2026-08-12T02:00:00Z'),
    ]
    const result = calculateTaskStudySummaries(sessions, [])
    expect(result.has('free')).toBe(false)
    expect(result.get('task-1')?.sessionCount).toBe(0)
    expect(result.get('task-1')?.totalSeconds).toBe(0)
    expect(result.get('task-1')?.lastStudiedAt).toBeNull()
  })
})
