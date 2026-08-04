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
        {weekDays.map((day, index) => <div key={day} className={`py-2.5 text-center text-xs font-semibold ${index > 4 ? 'text-[var(--rose)]' : 'text-[var(--muted)]'}`}>周{day}</div>)}
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
              className={`focus-ring relative min-h-[82px] min-w-0 border-b border-r border-[var(--line)] p-1.5 text-left transition hover:bg-[var(--accent-soft)] sm:min-h-[120px] sm:p-2.5 ${muted ? 'opacity-45' : ''} ${selected ? 'bg-[var(--accent-soft)]' : ''}`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-bold sm:h-8 sm:w-8 sm:text-sm ${isToday(date) ? 'bg-[var(--accent-strong)] text-white' : 'text-[var(--ink)]'}`}>{date.getDate()}</span>
                <span className={`mt-1 flex items-center gap-0.5 text-[10px] font-bold sm:text-xs ${allDone ? 'text-[var(--accent-strong)]' : 'text-[var(--muted)]'}`}>{allDone && <Check size={12} strokeWidth={2.5} />}{completed}/{dayTasks.length}</span>
              </div>
              {planDay?.isRestDay ? (
                <span className="mt-2 flex items-center gap-1 truncate text-[10px] font-semibold text-[var(--rose)] sm:text-xs"><Moon size={11} />休息日</span>
              ) : (
                <div className="mt-1.5 grid gap-0.5">
                  {dayTasks.slice(0, 3).map((task) => (
                    <span key={task.id} className={`truncate text-[9px] leading-4 sm:text-[11px] ${task.completed ? 'text-[var(--muted)] line-through' : 'text-[var(--ink)]'}`}>{task.title}</span>
                  ))}
                  {dayTasks.length > 3 && <span className="text-[9px] font-semibold text-[var(--muted)] sm:text-[11px]">还有 {dayTasks.length - 3} 项</span>}
                </div>
              )}
              {planDay?.note && <MessageCircle className="absolute bottom-1.5 right-1.5 text-[var(--rose)]" size={12} aria-label="有备注" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
