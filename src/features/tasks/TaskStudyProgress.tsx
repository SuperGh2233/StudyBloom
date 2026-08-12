import type { Task, TaskStudySummary } from '../../types'
import { formatDurationHuman } from '../../utils/studyDuration'

export function TaskStudyProgress({ task, summary, className = '' }: { task: Task; summary?: TaskStudySummary; className?: string }) {
  const seconds = summary?.totalSeconds ?? 0
  if (!task.estimatedMinutes && seconds === 0) return null
  const goalSeconds = task.estimatedMinutes ? task.estimatedMinutes * 60 : 0
  const percentage = goalSeconds ? Math.min(100, Math.round((seconds / goalSeconds) * 100)) : 0
  const actual = seconds > 0 ? formatDurationHuman(seconds) : '0 分钟'
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="truncate text-xs text-[var(--muted)]">
        {task.estimatedMinutes
          ? `已学习 ${actual} / 计划 ${task.estimatedMinutes} 分钟`
          : `已学习 ${actual}`}
      </p>
      {goalSeconds > 0 && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--line)]" aria-label={`学习进度 ${percentage}%`}>
          <span className="block h-full rounded-full bg-[var(--accent-strong)] transition-[width]" style={{ width: `${percentage}%` }} />
        </div>
      )}
    </div>
  )
}
