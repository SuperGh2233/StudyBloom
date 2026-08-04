import { Check, MessageCircle, Moon, Square, SquareCheck } from 'lucide-react'
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
    <div className="calendar-shell w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="calendar-grid grid min-w-0 border-b border-[var(--line)] bg-[var(--surface-soft)]">
        {weekDays.map((day, index) => <div key={day} className={`min-w-0 py-2.5 text-center text-[11px] font-semibold tracking-wide sm:py-3 sm:text-xs ${index > 4 ? 'text-[var(--rose)]' : 'text-[var(--muted)]'}`}>{day}</div>)}
      </div>
      <div className="calendar-grid grid min-w-0">
        {days.map((date) => {
          const key = keyForDate(date)
          const dayTasks = tasksByDate.get(key) ?? []
          const planDay = planDaysByDate.get(key)
          const completed = dayTasks.filter((task) => task.completed).length
          const hasTasks = dayTasks.length > 0
          const allDone = hasTasks && completed === dayTasks.length
          const muted = !isSameMonth(date, month)
          const selected = key === selectedDate
          return (
            <button
              type="button"
              key={key}
              onClick={() => onSelect(key)}
              aria-label={`${format(date, 'M月d日 EEEE', { locale: zhCN })}，${hasTasks ? `完成 ${completed}/${dayTasks.length}` : '暂无任务'}`}
              className={`calendar-day-cell focus-ring relative min-h-[88px] min-w-0 overflow-hidden border-b border-r border-[var(--line)] p-1 text-left transition hover:bg-[var(--accent-soft)] max-[380px]:min-h-[80px] sm:min-h-[124px] sm:p-2.5 ${muted ? 'opacity-45' : ''} ${selected ? 'bg-[var(--accent-soft)] ring-1 ring-inset ring-[var(--accent)]' : ''}`}
            >
              <div className="calendar-cell-head flex min-w-0 items-start justify-between gap-0.5">
                <span className={`calendar-day-number grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-bold max-[380px]:h-5 max-[380px]:w-5 max-[380px]:text-[10px] sm:h-8 sm:w-8 sm:text-sm ${isToday(date) ? 'bg-[var(--accent-strong)] text-white shadow-sm' : 'text-[var(--ink)]'}`}>{date.getDate()}</span>
                {hasTasks && (allDone ? (
                  <span className="calendar-progress mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent-soft)] p-1 text-[var(--accent-strong)]" aria-label={`已完成 ${completed}/${dayTasks.length}`}><Check size={11} strokeWidth={2.8} /><span className="calendar-progress-count hidden sm:inline">{completed}/{dayTasks.length}</span></span>
                ) : (
                  <span className="calendar-progress mt-0.5 inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-[var(--surface-soft)] px-1 py-1 text-[9px] font-bold leading-none text-[var(--muted)] max-[380px]:px-0.5 max-[380px]:text-[8px] sm:px-1.5 sm:text-xs">{completed}/{dayTasks.length}</span>
                ))}
              </div>
              {planDay?.isRestDay ? (
                <span className="calendar-rest-day mt-2 flex min-w-0 items-center gap-1 truncate text-[10px] font-semibold leading-4 text-[var(--rose)] sm:text-xs"><Moon size={11} className="shrink-0" /><span className="truncate"><span className="sm:hidden">休</span><span className="hidden sm:inline">休息日</span></span></span>
              ) : hasTasks ? (
                <div className="calendar-task-list mt-1.5 grid min-w-0 gap-0.5 sm:mt-2 sm:gap-1">
                  {dayTasks.slice(0, 3).map((task, index) => <span key={task.id} className={`calendar-task flex min-w-0 items-center gap-0.5 text-[10px] leading-[1.35] sm:text-[11px] ${index > 0 ? 'calendar-task-secondary' : ''} ${task.completed ? 'text-[var(--muted)] line-through' : 'text-[var(--ink)]'}`}>{task.completed ? <SquareCheck className="shrink-0 text-[var(--accent-strong)]" size={11} strokeWidth={2.5} aria-hidden="true" /> : <Square className="shrink-0 text-[var(--line)]" size={10} strokeWidth={2} aria-hidden="true" />}<span className="min-w-0 truncate">{task.title}</span></span>)}
                  {dayTasks.length > 1 && <span className="calendar-task-more block truncate text-[10px] font-semibold leading-[1.35] text-[var(--muted)] sm:hidden">+{dayTasks.length - 1}</span>}
                  {dayTasks.length > 3 && <span className="calendar-task-desktop-more hidden truncate text-[11px] font-semibold leading-[1.35] text-[var(--muted)] sm:block">还有 {dayTasks.length - 3} 项</span>}
                </div>
              ) : null}
              {planDay?.note && <MessageCircle className="absolute bottom-1.5 right-1.5 text-[var(--rose)] sm:bottom-2 sm:right-2" size={12} aria-label="有备注" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
