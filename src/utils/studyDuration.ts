import type {
  DateKey,
  DateSecondsRange,
  StudyDailyPoint,
  StudySession,
  StudySessionSegment,
  StudyTaskPoint,
  StudyTimeStatistics,
} from '../types';
import { enumerateDateKeys, formatDateKey } from './date';

/** Fixed UTC+8 local day boundary — must match formatDateKey in utils/date. */
const LOCAL_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Timer display like 01:25:36 (hours always shown). */
export function formatClockHMS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** Countdown display like 18:42 for pomodoro phases. */
export function formatClockMS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Human duration: "48 分钟" / "1 小时 25 分钟". */
export function formatDurationHuman(totalSeconds: number): string {
  const totalMinutes = Math.round(Math.max(0, totalSeconds) / 60);
  if (totalMinutes < 1) return '不足 1 分钟';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} 分钟`;
  return minutes ? `${hours} 小时 ${minutes} 分钟` : `${hours} 小时`;
}

/** True seconds of a segment; an open segment counts up to nowMs. */
export function segmentSeconds(
  segment: Pick<StudySessionSegment, 'startedAt' | 'endedAt'>,
  nowMs: number = Date.now(),
): number {
  const start = Date.parse(segment.startedAt);
  if (!Number.isFinite(start)) return 0;
  const end = segment.endedAt ? Date.parse(segment.endedAt) : nowMs;
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function totalSegmentSeconds(
  segments: Pick<StudySessionSegment, 'startedAt' | 'endedAt'>[],
  nowMs: number = Date.now(),
): number {
  return segments.reduce((sum, segment) => sum + segmentSeconds(segment, nowMs), 0);
}

export function sessionElapsedSeconds(
  session: Pick<StudySession, 'id'>,
  segments: StudySessionSegment[],
  nowMs: number = Date.now(),
): number {
  return totalSegmentSeconds(segments.filter((segment) => segment.sessionId === session.id), nowMs);
}

/** Remaining seconds of the current phase (0 when no phase is armed). */
export function phaseRemainingSeconds(
  session: Pick<StudySession, 'status' | 'phaseEndsAt' | 'phaseRemainingSeconds'>,
  nowMs: number = Date.now(),
): number {
  if (session.status === 'paused') return session.phaseRemainingSeconds ?? 0;
  if (session.status === 'running' && session.phaseEndsAt) {
    const end = Date.parse(session.phaseEndsAt);
    if (Number.isFinite(end)) return Math.max(0, Math.ceil((end - nowMs) / 1000));
  }
  return 0;
}

export function localDayStartMs(timestampMs: number): number {
  const shifted = new Date(timestampMs + LOCAL_OFFSET_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - LOCAL_OFFSET_MS;
}

/**
 * Split a time range into per-local-date pieces (UTC+8 day boundaries).
 * An open end (endedAt null) counts up to nowMs. A segment crossing midnight
 * is split so each local day only keeps its own share.
 */
export function splitRangeByLocalDate(
  startedAt: string,
  endedAt: string | null,
  nowMs: number = Date.now(),
): DateSecondsRange[] {
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return [];
  const endRaw = endedAt ? Date.parse(endedAt) : nowMs;
  const end = Math.max(start, Number.isFinite(endRaw) ? endRaw : nowMs);
  const pieces: DateSecondsRange[] = [];
  let cursor = start;
  while (cursor < end) {
    const boundary = localDayStartMs(cursor) + DAY_MS;
    const sliceEnd = Math.min(end, boundary);
    pieces.push({ date: formatDateKey(cursor), seconds: (sliceEnd - cursor) / 1000 });
    cursor = sliceEnd;
  }
  return pieces;
}

/** Which break follows a completed focus round. */
export function nextBreakPhase(completedRounds: number, roundsBeforeLongBreak: number): 'short_break' | 'long_break' {
  return completedRounds > 0 && completedRounds % roundsBeforeLongBreak === 0 ? 'long_break' : 'short_break';
}

/**
 * Pure study-time statistics over a date range. Segments are the only time
 * truth: breaks never appear here, open segments count up to nowMs, and
 * cross-midnight segments are split per local date (UTC+8). A session counts
 * when it has segment time inside the range; counts / longest / per-task use
 * only that in-range share. V0.4.1 rounds use their database completion time;
 * legacy rounds without provenance stay on plan_date so old totals are kept.
 */
export function calculateStudyStatistics(
  sessions: StudySession[],
  segments: StudySessionSegment[],
  range: { startDate: DateKey; endDate: DateKey },
  nowMs: number = Date.now(),
): StudyTimeStatistics {
  const days = enumerateDateKeys(range.startDate, range.endDate);
  const daySet = new Set(days);
  const sessionById = new Map(sessions.map((session) => [session.id, session]));

  const msByDay = new Map<DateKey, number>();
  const roundsByDay = new Map<DateKey, number>();
  const roundsInRangeBySession = new Map<string, number>();
  const markedRoundsBySession = new Map<string, Set<number>>();
  const seenRoundCompletions = new Set<string>();
  days.forEach((date) => {
    msByDay.set(date, 0);
    roundsByDay.set(date, 0);
  });

  let freeMs = 0;
  let focusMs = 0;
  const msBySession = new Map<string, number>();
  for (const segment of segments) {
    if (!sessionById.has(segment.sessionId)) continue;
    const kind = segment.segmentKind;
    for (const piece of splitRangeByLocalDate(segment.startedAt, segment.endedAt, nowMs)) {
      if (!daySet.has(piece.date)) continue;
      const ms = piece.seconds * 1000;
      msByDay.set(piece.date, (msByDay.get(piece.date) ?? 0) + ms);
      msBySession.set(segment.sessionId, (msBySession.get(segment.sessionId) ?? 0) + ms);
      if (kind === 'free') freeMs += ms;
      else focusMs += ms;
    }

    if (segment.segmentKind === 'focus' && segment.pomodoroRound && segment.pomodoroCompletedAt) {
      const completionMs = Date.parse(segment.pomodoroCompletedAt);
      if (!Number.isFinite(completionMs)) continue;
      const completionKey = `${segment.sessionId}:${segment.pomodoroRound}`;
      const sessionRounds = markedRoundsBySession.get(segment.sessionId) ?? new Set<number>();
      sessionRounds.add(segment.pomodoroRound);
      markedRoundsBySession.set(segment.sessionId, sessionRounds);
      if (seenRoundCompletions.has(completionKey)) continue;
      seenRoundCompletions.add(completionKey);
      const completionDate = formatDateKey(completionMs);
      if (!daySet.has(completionDate)) continue;
      roundsByDay.set(completionDate, (roundsByDay.get(completionDate) ?? 0) + 1);
      roundsInRangeBySession.set(segment.sessionId, (roundsInRangeBySession.get(segment.sessionId) ?? 0) + 1);
    }
  }

  // Old backups/sessions only stored an aggregate count. Preserve the portion
  // not represented by marked rounds and keep its historical plan_date rule.
  for (const session of sessions) {
    const markedCount = markedRoundsBySession.get(session.id)?.size ?? 0;
    const legacyRounds = Math.max(0, session.pomodoroCompletedRounds - markedCount);
    if (!legacyRounds || !daySet.has(session.planDate)) continue;
    roundsByDay.set(session.planDate, (roundsByDay.get(session.planDate) ?? 0) + legacyRounds);
    roundsInRangeBySession.set(session.id, (roundsInRangeBySession.get(session.id) ?? 0) + legacyRounds);
  }

  const sessionsInRange = sessions.filter((session) => (msBySession.get(session.id) ?? 0) > 0);

  const taskAggregates = new Map<string, { ms: number; rounds: number }>();
  let sessionCount = 0;
  let longestMs = 0;
  let totalRounds = 0;
  for (const session of sessionsInRange) {
    const ms = msBySession.get(session.id) ?? 0;
    sessionCount += 1;
    longestMs = Math.max(longestMs, ms);
    const key = session.taskTitleSnapshot.trim() || '自由学习';
    const bucket = taskAggregates.get(key) ?? { ms: 0, rounds: 0 };
    bucket.ms += ms;
    taskAggregates.set(key, bucket);
  }

  for (const session of sessions) {
    const rounds = roundsInRangeBySession.get(session.id) ?? 0;
    if (!rounds) continue;
    totalRounds += rounds;
    const key = session.taskTitleSnapshot.trim() || '自由学习';
    const bucket = taskAggregates.get(key) ?? { ms: 0, rounds: 0 };
    bucket.rounds += rounds;
    taskAggregates.set(key, bucket);
  }

  const byDay: StudyDailyPoint[] = days.map((date) => ({
    date,
    seconds: Math.floor((msByDay.get(date) ?? 0) / 1000),
    pomodoroRounds: roundsByDay.get(date) ?? 0,
  }));
  const byTask: StudyTaskPoint[] = [...taskAggregates.entries()]
    .map(([taskTitle, bucket]) => ({ taskTitle, seconds: Math.floor(bucket.ms / 1000), pomodoroRounds: bucket.rounds }))
    .sort((a, b) => b.seconds - a.seconds);

  const totalSeconds = Math.floor((freeMs + focusMs) / 1000);
  const activeDays = byDay.filter((day) => day.seconds > 0).length;
  return {
    totalSeconds,
    freeSeconds: Math.floor(freeMs / 1000),
    focusSeconds: Math.floor(focusMs / 1000),
    sessionCount,
    longestSessionSeconds: Math.floor(longestMs / 1000),
    completedPomodoroRounds: totalRounds,
    activeDays,
    averageDailySeconds: days.length ? Math.floor(totalSeconds / days.length) : 0,
    byDay,
    byTask,
  };
}

/** Label for the global active-session bar; title is '' during breaks. */
export function activeSessionSummary(
  session: StudySession,
  segments: StudySessionSegment[],
  nowMs: number = Date.now(),
): { title: string; detail: string; clock: string } {
  const taskTitle = session.taskTitleSnapshot.trim() || '自由学习';
  if (session.mode === 'free') {
    return {
      title: taskTitle,
      detail: session.status === 'paused' ? '已暂停' : '学习中',
      clock: formatClockHMS(sessionElapsedSeconds(session, segments, nowMs)),
    };
  }
  if (session.status === 'waiting') {
    const breakJustEnded = session.currentPhase === 'short_break' || session.currentPhase === 'long_break';
    return {
      title: taskTitle,
      detail: breakJustEnded ? '休息已结束' : `第 ${session.currentRound} 轮专注已完成`,
      clock: formatClockHMS(sessionElapsedSeconds(session, segments, nowMs)),
    };
  }
  if (session.currentPhase === 'short_break' || session.currentPhase === 'long_break') {
    return {
      title: '',
      detail: session.currentPhase === 'short_break' ? '短休息' : '长休息',
      clock: formatClockMS(phaseRemainingSeconds(session, nowMs)),
    };
  }
  const paused = session.status === 'paused';
  return {
    title: taskTitle,
    detail: `第 ${session.currentRound} 轮专注${paused ? ' · 已暂停' : ''}`,
    clock: formatClockMS(phaseRemainingSeconds(session, nowMs)),
  };
}
