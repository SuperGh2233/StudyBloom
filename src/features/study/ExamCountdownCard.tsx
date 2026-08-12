import { CalendarClock } from 'lucide-react'
import type { DateKey } from '../../types'
import { countdownDays } from '../../utils/countdown'

export function ExamCountdownCard({ title, targetDate }: { title: string; targetDate: DateKey }) {
  const days = countdownDays(targetDate)
  const [year, month, day] = targetDate.split('-').map(Number)
  return (
    <section className="surface min-w-0 rounded-2xl p-4" aria-label={`${title}倒计时`}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--rose-soft)] text-[var(--rose)]"><CalendarClock size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-[var(--rose)]">{title}</p>
          {days > 0 ? <p className="mt-0.5"><strong className="text-2xl tracking-tight">{days}</strong><span className="ml-1 text-sm font-semibold">天</span></p> : <strong className="mt-1 block truncate text-base">{days === 0 ? '今天，稳稳发挥' : '目标日已经到来'}</strong>}
        </div>
        <p className="shrink-0 text-right text-xs leading-5 text-[var(--muted)]">{year} 年<br />{month} 月 {day} 日</p>
      </div>
    </section>
  )
}
