import { CalendarClock } from 'lucide-react'
import type { DateKey } from '../../types'
import { countdownDays } from '../../utils/countdown'

export function ExamCountdownCard({ title, targetDate }: { title: string; targetDate: DateKey }) {
  const days = countdownDays(targetDate)
  const [year, month, day] = targetDate.split('-').map(Number)
  return (
    <section className="surface min-w-0 rounded-2xl p-4 sm:p-5" aria-label={`${title}倒计时`}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--rose-soft)] text-[var(--rose)]"><CalendarClock size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--rose)]">重要日子</p>
          <h2 className="mt-0.5 line-clamp-2 break-words text-base font-bold">{title}</h2>
        </div>
        <p className="shrink-0 text-right text-xs leading-5 text-[var(--muted)]">{year} 年<br />{month} 月 {day} 日</p>
      </div>
      {days > 0 ? <p className="mt-4 flex items-baseline gap-1 text-[var(--ink)]"><strong className="text-4xl font-bold tabular-nums tracking-[-0.04em]">{days}</strong><span className="text-sm font-semibold text-[var(--muted)]">天后见</span></p> : <strong className="mt-4 block text-lg">{days === 0 ? '今天，稳稳发挥' : '目标日已经到来'}</strong>}
    </section>
  )
}
