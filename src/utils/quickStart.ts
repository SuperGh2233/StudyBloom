import type { StudyMode, StudyPreferences, Task } from '../types'
import { POMODORO_LIMITS } from '../types'
import type { StartSessionInput } from '../services/studySessions'

export const FIRST_TASK_TEMPLATES = [
  { title: '英语单词', estimatedMinutes: 30 },
  { title: '数学刷题', estimatedMinutes: 60 },
  { title: '专业课背诵', estimatedMinutes: 60 },
  { title: '政治复习', estimatedMinutes: 30 },
] as const

export function selectQuickStartTask(tasks: Task[]): Task | null {
  return [...tasks]
    .filter((task) => !task.completed)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))[0] ?? null
}

export function buildQuickStartInput(
  taskId: string | null,
  preferences: StudyPreferences | null,
  forcedMode?: StudyMode,
): StartSessionInput {
  const mode = forcedMode ?? preferences?.defaultMode ?? 'pomodoro'
  if (mode === 'free') return { mode, taskId }
  return {
    mode,
    taskId,
    focusSeconds: preferences?.focusSeconds ?? POMODORO_LIMITS.focusSeconds.fallback,
    shortBreakSeconds: preferences?.shortBreakSeconds ?? POMODORO_LIMITS.shortBreakSeconds.fallback,
    longBreakSeconds: preferences?.longBreakSeconds ?? POMODORO_LIMITS.longBreakSeconds.fallback,
    roundsBeforeLongBreak: preferences?.roundsBeforeLongBreak ?? POMODORO_LIMITS.roundsBeforeLongBreak.fallback,
  }
}
