import { Sparkles, Target } from 'lucide-react'
import { formatDurationHuman } from '../../utils/studyDuration'

export function DailyGoalCard({ enabled, minutes, studiedSeconds, compact = false }: { enabled: boolean; minutes: number; studiedSeconds: number; compact?: boolean }) {
  const rate = enabled ? Math.round((studiedSeconds / (minutes * 60)) * 100) : 0
  const completed = enabled && rate >= 100
  return (
    <section className={`surface min-w-0 rounded-2xl ${compact ? 'p-4' : 'p-5'} ${completed ? 'gentle-enter ring-1 ring-[var(--accent)]' : ''}`} aria-label="今日学习目标">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${completed ? 'bg-[var(--accent-strong)] text-white' : 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'}`}>{completed ? <Sparkles size={20} /> : <Target size={20} />}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-[var(--muted)]">今日已学习</p>
          <strong className="block truncate text-lg">{formatDurationHuman(studiedSeconds)}</strong>
        </div>
        <div className="shrink-0 text-right">
          <strong className="block text-lg text-[var(--accent-strong)]">{enabled ? `${rate}%` : '未开启'}</strong>
          <span className="text-xs text-[var(--muted)]">{enabled ? `目标 ${minutes} 分钟` : '每日目标'}</span>
        </div>
      </div>
      {enabled && <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--line)]"><span className="block h-full rounded-full bg-[var(--accent-strong)] transition-[width]" style={{ width: `${Math.min(100, rate)}%` }} /></div>}
      {completed && <p className="mt-3 text-sm font-semibold text-[var(--accent-strong)]">今天的目标已经完成，辛苦啦。</p>}
    </section>
  )
}
