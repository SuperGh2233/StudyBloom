import { describe, expect, it } from 'vitest'
import type { StudySession, StudySessionSegment } from '../types'
import {
  activeSessionSummary,
  calculateStudyStatistics,
  formatClockHMS,
  formatClockMS,
  formatDurationHuman,
  nextBreakPhase,
  phaseRemainingSeconds,
  sessionElapsedSeconds,
  segmentSeconds,
  splitRangeByLocalDate,
  totalSegmentSeconds,
} from './studyDuration'

// All timestamps are written with +08:00 offsets: the app's local date
// convention (formatDateKey) is fixed UTC+8.
const sessionDefaults: StudySession = {
  id: 'session-1',
  userId: 'user-1',
  taskId: null,
  taskTitleSnapshot: '',
  attendanceRecordId: null,
  planDate: '2026-08-10',
  mode: 'free',
  status: 'completed',
  startedAt: '2026-08-10T09:00:00+08:00',
  endedAt: '2026-08-10T10:00:00+08:00',
  pomodoroFocusSeconds: null,
  pomodoroShortBreakSeconds: null,
  pomodoroLongBreakSeconds: null,
  pomodoroRoundsBeforeLongBreak: null,
  pomodoroCompletedRounds: 0,
  currentPhase: null,
  currentRound: 0,
  phaseStartedAt: null,
  phaseEndsAt: null,
  phaseRemainingSeconds: null,
  createdAt: '2026-08-10T09:00:00+08:00',
  updatedAt: '2026-08-10T10:00:00+08:00',
}

const session = (overrides: Partial<StudySession> = {}): StudySession => ({ ...sessionDefaults, ...overrides })

const segment = (overrides: Partial<StudySessionSegment> = {}): StudySessionSegment => ({
  id: `segment-${Math.random()}`,
  userId: 'user-1',
  sessionId: 'session-1',
  segmentKind: 'free',
  pomodoroRound: null,
  pomodoroCompletedAt: null,
  startedAt: '2026-08-10T09:00:00+08:00',
  endedAt: '2026-08-10T09:30:00+08:00',
  createdAt: '2026-08-10T09:00:00+08:00',
  ...overrides,
})

const T0 = Date.parse('2026-08-10T09:00:00+08:00')
const MIN = 60_000

describe('秒数格式化', () => {
  it('计时器使用 01:25:36 格式', () => {
    expect(formatClockHMS(0)).toBe('00:00:00')
    expect(formatClockHMS(5136)).toBe('01:25:36')
    expect(formatClockHMS(2538)).toBe('00:42:18')
    expect(formatClockMS(1122)).toBe('18:42')
    expect(formatClockMS(258)).toBe('04:18')
    expect(formatClockHMS(-5)).toBe('00:00:00')
  })

  it('人类可读时长按分钟与小时展示', () => {
    expect(formatDurationHuman(48 * 60)).toBe('48 分钟')
    expect(formatDurationHuman(85 * 60)).toBe('1 小时 25 分钟')
    expect(formatDurationHuman(120 * 60)).toBe('2 小时')
    expect(formatDurationHuman(20)).toBe('不足 1 分钟')
  })
})

describe('自由计时', () => {
  it('运行中时长按数据库时间戳计算', () => {
    const open = segment({ startedAt: '2026-08-10T09:00:00+08:00', endedAt: null })
    expect(segmentSeconds(open, T0 + 42_500)).toBe(42)
  })

  it('暂停期间不计时', () => {
    // 学习 10 分钟 → 暂停 10 分钟 → 再学 5 分钟
    const segments = [
      segment({ startedAt: '2026-08-10T09:00:00+08:00', endedAt: '2026-08-10T09:10:00+08:00' }),
      segment({ startedAt: '2026-08-10T09:20:00+08:00', endedAt: '2026-08-10T09:25:00+08:00' }),
    ]
    expect(totalSegmentSeconds(segments, T0 + 30 * MIN)).toBe(15 * 60)
  })

  it('多片段求和', () => {
    const segments = [
      segment({ startedAt: '2026-08-10T09:00:00+08:00', endedAt: '2026-08-10T09:10:00+08:00' }),
      segment({ startedAt: '2026-08-10T09:15:00+08:00', endedAt: '2026-08-10T09:20:00+08:00' }),
      segment({ startedAt: '2026-08-10T09:30:00+08:00', endedAt: null }),
    ]
    expect(totalSegmentSeconds(segments, T0 + 35 * MIN)).toBe((10 + 5 + 5) * 60)
  })

  it('刷新后按时间戳恢复，不依赖前端累加', () => {
    // 模拟页面在 09:40 关闭、09:55 重新打开：片段行未变，仅 nowMs 前进。
    const open = segment({ startedAt: '2026-08-10T09:30:00+08:00', endedAt: null })
    const closed = segment({ startedAt: '2026-08-10T09:00:00+08:00', endedAt: '2026-08-10T09:10:00+08:00' })
    const segments = [closed, open]
    const before = sessionElapsedSeconds(session(), segments, Date.parse('2026-08-10T09:40:00+08:00'))
    const after = sessionElapsedSeconds(session(), segments, Date.parse('2026-08-10T09:55:00+08:00'))
    expect(before).toBe(10 * 60 + 10 * 60)
    expect(after).toBe(before + 15 * 60)
  })
})

describe('番茄专注', () => {
  it('专注正常结束时片段正好等于计划时长', () => {
    const focus = segment({
      segmentKind: 'focus',
      startedAt: '2026-08-10T09:00:00+08:00',
      endedAt: '2026-08-10T09:25:00+08:00',
    })
    expect(segmentSeconds(focus, T0 + 60 * MIN)).toBe(25 * 60)
  })

  it('暂停后剩余时间不随时间减少', () => {
    const paused = session({ status: 'paused', mode: 'pomodoro', phaseRemainingSeconds: 1200, phaseEndsAt: null })
    expect(phaseRemainingSeconds(paused, T0)).toBe(1200)
    expect(phaseRemainingSeconds(paused, T0 + 5 * MIN)).toBe(1200)
  })

  it('恢复后结束时间从恢复时刻顺延', () => {
    // 数据库恢复时写入 phase_ends_at = 恢复时刻 + 剩余秒数；前端据此倒计时。
    const resumeAt = T0 + 10 * MIN
    const running = session({
      status: 'running',
      mode: 'pomodoro',
      currentPhase: 'focus',
      phaseEndsAt: new Date(resumeAt + 1200_000).toISOString(),
    })
    expect(phaseRemainingSeconds(running, resumeAt)).toBe(1200)
    expect(phaseRemainingSeconds(running, resumeAt + 300_000)).toBe(900)
  })

  it('休息时间不计入学习时长', () => {
    // 专注 25 分钟 → 休息 5 分钟（无片段）→ 专注 25 分钟
    const pomodoro = session({
      mode: 'pomodoro',
      pomodoroFocusSeconds: 1500,
      pomodoroShortBreakSeconds: 300,
      pomodoroLongBreakSeconds: 900,
      pomodoroRoundsBeforeLongBreak: 4,
      pomodoroCompletedRounds: 2,
    })
    const segments = [
      segment({ segmentKind: 'focus', startedAt: '2026-08-10T09:00:00+08:00', endedAt: '2026-08-10T09:25:00+08:00' }),
      segment({ segmentKind: 'focus', startedAt: '2026-08-10T09:30:00+08:00', endedAt: '2026-08-10T09:55:00+08:00' }),
    ]
    const stats = calculateStudyStatistics([pomodoro], segments, { startDate: '2026-08-10', endDate: '2026-08-10' }, T0 + 120 * MIN)
    expect(stats.totalSeconds).toBe(50 * 60)
    expect(stats.focusSeconds).toBe(50 * 60)
    expect(stats.freeSeconds).toBe(0)
  })

  it('完成指定轮数后进入长休息', () => {
    expect(nextBreakPhase(4, 4)).toBe('long_break')
    expect(nextBreakPhase(8, 4)).toBe('long_break')
    expect(nextBreakPhase(3, 4)).toBe('short_break')
    expect(nextBreakPhase(1, 4)).toBe('short_break')
    expect(nextBreakPhase(2, 2)).toBe('long_break')
  })

  it('提前结束的专注计入实际时长但不增加完成轮数', () => {
    // 25 分钟专注只进行了 10 分钟就结束整个会话：数据库轮数保持 0。
    const early = session({
      mode: 'pomodoro',
      pomodoroFocusSeconds: 1500,
      pomodoroShortBreakSeconds: 300,
      pomodoroLongBreakSeconds: 900,
      pomodoroRoundsBeforeLongBreak: 4,
      pomodoroCompletedRounds: 0,
    })
    const partial = segment({ segmentKind: 'focus', startedAt: '2026-08-10T09:00:00+08:00', endedAt: '2026-08-10T09:10:00+08:00' })
    const stats = calculateStudyStatistics([early], [partial], { startDate: '2026-08-10', endDate: '2026-08-10' }, T0 + 60 * MIN)
    expect(stats.focusSeconds).toBe(10 * 60)
    expect(stats.completedPomodoroRounds).toBe(0)
  })

  it('页面关闭后重新打开，阶段过期的片段准确结束在计划时间', () => {
    // 专注本应 09:25 结束；页面 10:40 才恢复，sync 已把片段关闭在 09:25。
    const synced = segment({
      segmentKind: 'focus',
      startedAt: '2026-08-10T09:00:00+08:00',
      endedAt: '2026-08-10T09:25:00+08:00',
    })
    expect(segmentSeconds(synced, Date.parse('2026-08-10T10:40:00+08:00'))).toBe(25 * 60)
  })

  it('活动条文案覆盖自由计时、专注与休息', () => {
    const free = session({ taskTitleSnapshot: '英语单词', status: 'running' })
    const freeSummary = activeSessionSummary(free, [segment({ startedAt: '2026-08-10T09:00:00+08:00', endedAt: null })], T0 + 42 * MIN + 18_000)
    expect(freeSummary.title).toBe('英语单词')
    expect(freeSummary.detail).toBe('学习中')
    expect(freeSummary.clock).toBe('00:42:18')

    const focus = session({
      mode: 'pomodoro',
      taskTitleSnapshot: '英语阅读',
      status: 'running',
      currentPhase: 'focus',
      currentRound: 2,
      phaseEndsAt: new Date(T0 + 18 * MIN + 42_000).toISOString(),
    })
    const focusSummary = activeSessionSummary(focus, [], T0)
    expect(focusSummary.detail).toBe('第 2 轮专注')
    expect(focusSummary.clock).toBe('18:42')

    const rest = session({ mode: 'pomodoro', status: 'running', currentPhase: 'short_break', phaseEndsAt: new Date(T0 + 4 * MIN + 18_000).toISOString() })
    const restSummary = activeSessionSummary(rest, [], T0)
    expect(restSummary.title).toBe('')
    expect(restSummary.detail).toBe('短休息')
    expect(restSummary.clock).toBe('04:18')

    // waiting 时 current_phase 保留「刚结束的阶段」：专注结束等待休息 vs 休息结束等待下一轮。
    const waitingFocus = session({ mode: 'pomodoro', status: 'waiting', currentPhase: 'focus', currentRound: 2, taskTitleSnapshot: '英语阅读' })
    expect(activeSessionSummary(waitingFocus, [], T0).detail).toBe('第 2 轮专注已完成')
    const waitingBreak = session({ mode: 'pomodoro', status: 'waiting', currentPhase: 'short_break', currentRound: 2, taskTitleSnapshot: '英语阅读' })
    expect(activeSessionSummary(waitingBreak, [], T0).detail).toBe('休息已结束')
  })
})

describe('学习统计', () => {
  const range = { startDate: '2026-08-10', endDate: '2026-08-10' }

  it('每日统计汇总时长、次数与最长单次', () => {
    const sessions = [
      session({ id: 'a', startedAt: '2026-08-10T09:00:00+08:00', endedAt: '2026-08-10T09:30:00+08:00' }),
      session({ id: 'b', taskTitleSnapshot: '数学', startedAt: '2026-08-10T14:00:00+08:00', endedAt: '2026-08-10T15:00:00+08:00' }),
    ]
    const segments = [
      segment({ sessionId: 'a', startedAt: '2026-08-10T09:00:00+08:00', endedAt: '2026-08-10T09:30:00+08:00' }),
      segment({ sessionId: 'b', startedAt: '2026-08-10T14:00:00+08:00', endedAt: '2026-08-10T15:00:00+08:00' }),
    ]
    const stats = calculateStudyStatistics(sessions, segments, range, T0 + 12 * 60 * MIN)
    expect(stats.totalSeconds).toBe(90 * 60)
    expect(stats.sessionCount).toBe(2)
    expect(stats.longestSessionSeconds).toBe(60 * 60)
    expect(stats.averageDailySeconds).toBe(90 * 60)
    expect(stats.byDay.find((day) => day.date === '2026-08-10')?.seconds).toBe(90 * 60)
  })

  it('每周统计跨天累计并计算日均', () => {
    const sessions = [
      session({ id: 'a', planDate: '2026-08-10', startedAt: '2026-08-10T09:00:00+08:00', endedAt: '2026-08-10T10:00:00+08:00' }),
      session({ id: 'b', planDate: '2026-08-12', startedAt: '2026-08-12T09:00:00+08:00', endedAt: '2026-08-12T09:30:00+08:00' }),
    ]
    const segments = [
      segment({ sessionId: 'a', startedAt: '2026-08-10T09:00:00+08:00', endedAt: '2026-08-10T10:00:00+08:00' }),
      segment({ sessionId: 'b', startedAt: '2026-08-12T09:00:00+08:00', endedAt: '2026-08-12T09:30:00+08:00' }),
    ]
    const stats = calculateStudyStatistics(sessions, segments, { startDate: '2026-08-10', endDate: '2026-08-16' }, T0 + 7 * 24 * 60 * MIN)
    expect(stats.totalSeconds).toBe(90 * 60)
    expect(stats.averageDailySeconds).toBe(Math.floor((90 * 60) / 7))
    expect(stats.activeDays).toBe(2)
  })

  it('每月统计包含无学习日且范围外会话不参与', () => {
    const sessions = [
      session({ id: 'in', planDate: '2026-08-01', startedAt: '2026-08-01T09:00:00+08:00', endedAt: '2026-08-01T09:20:00+08:00' }),
      session({ id: 'out', planDate: '2026-07-31', startedAt: '2026-07-31T09:00:00+08:00', endedAt: '2026-07-31T12:00:00+08:00' }),
    ]
    const segments = [
      segment({ sessionId: 'in', startedAt: '2026-08-01T09:00:00+08:00', endedAt: '2026-08-01T09:20:00+08:00' }),
      segment({ sessionId: 'out', startedAt: '2026-07-31T09:00:00+08:00', endedAt: '2026-07-31T12:00:00+08:00' }),
    ]
    const stats = calculateStudyStatistics(sessions, segments, { startDate: '2026-08-01', endDate: '2026-08-31' }, Date.parse('2026-08-31T23:00:00+08:00'))
    expect(stats.totalSeconds).toBe(20 * 60)
    expect(stats.sessionCount).toBe(1)
    expect(stats.averageDailySeconds).toBe(Math.floor((20 * 60) / 31))
  })

  it('跨午夜片段按本地日期拆分', () => {
    const sessions = [session({ id: 'night', planDate: '2026-08-10', startedAt: '2026-08-10T23:00:00+08:00', endedAt: '2026-08-11T01:00:00+08:00' })]
    const segments = [segment({ sessionId: 'night', startedAt: '2026-08-10T23:00:00+08:00', endedAt: '2026-08-11T01:00:00+08:00' })]
    const pieces = splitRangeByLocalDate('2026-08-10T23:00:00+08:00', '2026-08-11T01:00:00+08:00', T0)
    expect(pieces).toEqual([
      { date: '2026-08-10', seconds: 3600 },
      { date: '2026-08-11', seconds: 3600 },
    ])
    const stats = calculateStudyStatistics(sessions, segments, { startDate: '2026-08-10', endDate: '2026-08-11' }, T0 + 2 * 24 * 60 * MIN)
    expect(stats.byDay.find((day) => day.date === '2026-08-10')?.seconds).toBe(3600)
    expect(stats.byDay.find((day) => day.date === '2026-08-11')?.seconds).toBe(3600)
    expect(stats.totalSeconds).toBe(7200)
  })

  it('跨午夜完成的番茄轮数计入实际完成日期', () => {
    const pomodoro = session({
      id: 'night-pomodoro',
      planDate: '2026-08-10',
      mode: 'pomodoro',
      taskTitleSnapshot: '英语阅读',
      pomodoroFocusSeconds: 1500,
      pomodoroShortBreakSeconds: 300,
      pomodoroLongBreakSeconds: 900,
      pomodoroRoundsBeforeLongBreak: 4,
      pomodoroCompletedRounds: 1,
    })
    const fragments = [
      segment({
        id: 'night-focus-a',
        sessionId: pomodoro.id,
        segmentKind: 'focus',
        pomodoroRound: 1,
        pomodoroCompletedAt: '2026-08-11T00:15:00+08:00',
        startedAt: '2026-08-10T23:50:00+08:00',
        endedAt: '2026-08-11T00:00:00+08:00',
      }),
      segment({
        id: 'night-focus-b',
        sessionId: pomodoro.id,
        segmentKind: 'focus',
        pomodoroRound: 1,
        pomodoroCompletedAt: '2026-08-11T00:15:00+08:00',
        startedAt: '2026-08-11T00:00:00+08:00',
        endedAt: '2026-08-11T00:15:00+08:00',
      }),
    ]
    const stats = calculateStudyStatistics([pomodoro], fragments, { startDate: '2026-08-10', endDate: '2026-08-11' })
    expect(stats.byDay.find((day) => day.date === '2026-08-10')?.pomodoroRounds).toBe(0)
    expect(stats.byDay.find((day) => day.date === '2026-08-11')?.pomodoroRounds).toBe(1)
    expect(stats.completedPomodoroRounds).toBe(1)
    expect(stats.byTask[0].pomodoroRounds).toBe(1)
  })

  it('旧番茄汇总与新完成标记混合时不重复计数', () => {
    const pomodoro = session({
      id: 'mixed-pomodoro',
      mode: 'pomodoro',
      pomodoroCompletedRounds: 3,
      taskTitleSnapshot: '数学',
    })
    const marked = segment({
      sessionId: pomodoro.id,
      segmentKind: 'focus',
      pomodoroRound: 3,
      pomodoroCompletedAt: '2026-08-11T00:10:00+08:00',
      startedAt: '2026-08-10T23:55:00+08:00',
      endedAt: '2026-08-11T00:10:00+08:00',
    })
    const stats = calculateStudyStatistics([pomodoro], [marked], { startDate: '2026-08-10', endDate: '2026-08-11' })
    expect(stats.completedPomodoroRounds).toBe(3)
    expect(stats.byDay.find((day) => day.date === '2026-08-10')?.pomodoroRounds).toBe(2)
    expect(stats.byDay.find((day) => day.date === '2026-08-11')?.pomodoroRounds).toBe(1)
  })

  it('只查次日时，跨午夜学习的次日时长仍被计入', () => {
    // 08-10 23:00 开始（plan_date=08-10），08-11 01:00 结束；只统计 08-11。
    const sessions = [session({ id: 'night', planDate: '2026-08-10', startedAt: '2026-08-10T23:00:00+08:00', endedAt: '2026-08-11T01:00:00+08:00' })]
    const segments = [segment({ sessionId: 'night', startedAt: '2026-08-10T23:00:00+08:00', endedAt: '2026-08-11T01:00:00+08:00' })]
    const stats = calculateStudyStatistics(sessions, segments, { startDate: '2026-08-11', endDate: '2026-08-11' }, T0 + 2 * 24 * 60 * MIN)
    expect(stats.totalSeconds).toBe(3600)
    expect(stats.sessionCount).toBe(1)
    expect(stats.longestSessionSeconds).toBe(3600)
  })

  it('自由学习与番茄专注分开统计', () => {
    const sessions = [
      session({ id: 'free', taskTitleSnapshot: '' }),
      session({ id: 'pomo', mode: 'pomodoro', taskTitleSnapshot: '英语阅读', pomodoroFocusSeconds: 1500, pomodoroShortBreakSeconds: 300, pomodoroLongBreakSeconds: 900, pomodoroRoundsBeforeLongBreak: 4, pomodoroCompletedRounds: 2 }),
    ]
    const segments = [
      segment({ sessionId: 'free', segmentKind: 'free', startedAt: '2026-08-10T09:00:00+08:00', endedAt: '2026-08-10T09:30:00+08:00' }),
      segment({ sessionId: 'pomo', segmentKind: 'focus', startedAt: '2026-08-10T10:00:00+08:00', endedAt: '2026-08-10T10:25:00+08:00' }),
      segment({ sessionId: 'pomo', segmentKind: 'focus', startedAt: '2026-08-10T10:30:00+08:00', endedAt: '2026-08-10T10:55:00+08:00' }),
    ]
    const stats = calculateStudyStatistics(sessions, segments, range, T0 + 12 * 60 * MIN)
    expect(stats.freeSeconds).toBe(30 * 60)
    expect(stats.focusSeconds).toBe(50 * 60)
    expect(stats.completedPomodoroRounds).toBe(2)
    expect(stats.byTask.find((task) => task.taskTitle === '自由学习')?.seconds).toBe(30 * 60)
    expect(stats.byTask.find((task) => task.taskTitle === '英语阅读')?.pomodoroRounds).toBe(2)
  })

  it('任务删除后历史学习记录仍可按快照读取', () => {
    const deleted = session({ id: 'orphan', taskId: null, taskTitleSnapshot: '被删除的任务' })
    const segments = [segment({ sessionId: 'orphan', startedAt: '2026-08-10T09:00:00+08:00', endedAt: '2026-08-10T09:48:00+08:00' })]
    const stats = calculateStudyStatistics([deleted], segments, range, T0 + 12 * 60 * MIN)
    expect(stats.totalSeconds).toBe(48 * 60)
    expect(stats.byTask[0].taskTitle).toBe('被删除的任务')
  })

  it('进行中的片段统计到当前时间', () => {
    const sessions = [session({ id: 'live', status: 'running', endedAt: null })]
    const segments = [segment({ sessionId: 'live', startedAt: '2026-08-10T09:00:00+08:00', endedAt: null })]
    const stats = calculateStudyStatistics(sessions, segments, range, T0 + 48 * MIN)
    expect(stats.totalSeconds).toBe(48 * 60)
  })
})
