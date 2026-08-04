import { Check, MessageCircle, Moon } from 'lucide-react'
import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { PlanDay, Task } from '../../types'
import { dateKeyFromParts } from '../../utils/date'

const weekDays = ['一', '二', '三', '四', '五', '六', '日']

function keyForDate(date: Date) { return dateKeyFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate()) }

interface CalendarGridProps {
  month: Date
  tasksByDate: Map<string, Task[]>
  planDaysByDate: Map<string, PlanDay>
  selectedDate?: string
  onSelect: (date: string) => void
}

export function CalendarGrid({ month, tasksByDate, planDaysByDate, selectedDate, onSelect }: CalendarGridProps) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="calendar-grid grid border-b border-[var(--line)] bg-[var(--surface-soft)]">
        {weekDays.map((day, index) => <div key={day} className={`py-3 text-center text-[11px] font-semibold tracking-wide sm:text-xs ${index > 4 ? 'text-[var(--rose)]' : 'text-[var(--muted)]'}`}>{day}</div>)}
      </div>
      <div className="calendar-grid grid">
        {days.map((date) => {
          const key = keyForDate(date)
          const dayTasks = tasksByDate.get(key) ?? []
          const planDay = planDaysByDate.get(key)
          const completed = dayTasks.filter((task) => task.completed).length
          const allDone = dayTasks.length > 0 && completed === dayTasks.length
          const muted = !isSameMonth(date, month)
          const selected = key === selectedDate
          return (
            <button
              type="button"
              key={key}
              onClick={() => onSelect(key)}
              aria-label={`${format(date, 'M月d日 EEEE', { locale: zhCN })}，${dayTasks.length ? `完成 ${completed}/${dayTasks.length}` : '暂无任务'}`}
              className={`focus-ring relative min-h-[96px] min-w-0 border-b border-r border-[var(--line)] p-1.5 text-left transition hover:bg-[var(--accent-soft)] sm:min-h-[124px] sm:p-2.5 ${muted ? 'opacity-45' : ''} ${selected ? 'bg-[var(--accent-soft)] ring-1 ring-inset ring-[var(--accent)]' : ''}`}
            >
              <div className="flex items-start justify-between gap-0.5">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold sm:h-8 sm:w-8 sm:text-sm ${isToday(date) ? 'bg-[var(--accent-strong)] text-white shadow-sm' : 'text-[var(--ink)]'}`}>{date.getDate()}</span>
                <span className={`mt-0.5 inline-flex min-w-0 shrink-0 items-center gap-0.5 rounded-full px-1 py-1 text-[10px] font-bold leading-none sm:px-1.5 sm:text-xs ${allDone ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'bg-[var(--surface-soft)] text-[var(--muted)]'}`}>{allDone && <Check size={11} strokeWidth={2.5} />}{completed}/{dayTasks.length}</span>
              </div>
              {planDay?.isRestDay ? (
                <span className="mt-2 flex min-w-0 items-center gap-1 truncate text-[10px] font-semibold leading-4 text-[var(--rose)] sm:text-xs"><Moon size={11} className="shrink-0" /><span className="truncate">休息日</span></span>
              ) : (
                <div className="mt-2 grid min-w-0 gap-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <span key={task.id} className={`block min-w-0 truncate text-[10px] leading-[1.35] sm:text-[11px] ${task.completed ? 'text-[var(--muted)] line-through' : 'text-[var(--ink)]'}`}>{task.title}</span>
                  ))}
                  {dayTasks.length > 3 && <span className="block truncate text-[10px] font-semibold leading-[1.35] text-[var(--muted)] sm:text-[11px]">还有 {dayTasks.length - 3} 项</span>}
                </div>
              )}
              {planDay?.note && <MessageCircle className="absolute bottom-2 right-2 text-[var(--rose)]" size={13} aria-label="有备注" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
