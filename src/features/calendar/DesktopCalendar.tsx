import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Check, Moon, Plus, Square, SquareCheck } from 'lucide-react'
import type { PlanDay, Task } from '../../types'
import { dateKeyFromParts } from '../../utils/date'

const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const MAX_LINES = 5

function keyForDate(date: Date) { return dateKeyFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate()) }

interface DesktopCalendarProps {
  month: Date
  tasksByDate: Map<string, Task[]>
  planDaysByDate: Map<string, PlanDay>
  selectedDate?: string
  onSelect: (date: string) => void
  onToggle: (id: string, completed: boolean) => Promise<void>
}

/** Desktop-only poster-style month table: weekday header, then one date row + one task row per week. */
export function DesktopCalendar({ month, tasksByDate, planDaysByDate, selectedDate, onSelect, onToggle }: DesktopCalendarProps) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })
  const weeks: Date[][] = []
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7))

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-[var(--surface)]">
      <div className="calendar-grid grid min-w-0 border-b border-[var(--line-strong)] bg-[var(--surface-soft)]">
        {weekDays.map((label, index) => (
          <div key={label} className={`grid h-11 min-w-0 place-items-center text-[13px] font-semibold tracking-wide ${index > 4 ? 'text-[var(--rose)]' : 'text-[var(--muted)]'}`}>{label}</div>
        ))}
      </div>
      {weeks.map((week, index) => (
        <CalendarWeek
          key={keyForDate(week[0])}
          week={week}
          month={month}
          isLast={index === weeks.length - 1}
          tasksByDate={tasksByDate}
          planDaysByDate={planDaysByDate}
          selectedDate={selectedDate}
          onSelect={onSelect}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}

interface CalendarWeekProps extends DesktopCalendarProps {
  week: Date[]
  isLast: boolean
}

function CalendarWeek({ week, month, isLast, tasksByDate, planDaysByDate, selectedDate, onSelect, onToggle }: CalendarWeekProps) {
  return (
    <div className={isLast ? undefined : 'border-b border-[var(--line-strong)]'}>
      <CalendarDateRow week={week} month={month} tasksByDate={tasksByDate} selectedDate={selectedDate} onSelect={onSelect} />
      <CalendarTaskRow week={week} month={month} tasksByDate={tasksByDate} planDaysByDate={planDaysByDate} selectedDate={selectedDate} onSelect={onSelect} onToggle={onToggle} />
    </div>
  )
}

interface CalendarDateRowProps {
  week: Date[]
  month: Date
  tasksByDate: Map<string, Task[]>
  selectedDate?: string
  onSelect: (date: string) => void
}

function CalendarDateRow({ week, month, tasksByDate, selectedDate, onSelect }: CalendarDateRowProps) {
  return (
    <div className="calendar-grid grid min-w-0 border-b border-[var(--line-strong)]">
      {week.map((date, index) => {
        const key = keyForDate(date)
        const tasks = tasksByDate.get(key) ?? []
        const completed = tasks.filter((task) => task.completed).length
        const allDone = tasks.length > 0 && completed === tasks.length
        const selected = key === selectedDate
        return (
          <button
            type="button"
            key={key}
            onClick={() => onSelect(key)}
            title={tasks.length ? `完成 ${completed}/${tasks.length}` : undefined}
            aria-label={`${format(date, 'M月d日 EEEE', { locale: zhCN })}，${tasks.length ? `完成 ${completed}/${tasks.length}` : '暂无任务'}`}
            className={`focus-ring flex h-9 min-w-0 items-center justify-center gap-1 transition hover:bg-[var(--surface-soft)] ${index < 6 ? 'border-r border-[var(--line)]' : ''} ${selected ? 'bg-[var(--accent-soft)]' : ''} ${!isSameMonth(date, month) ? 'opacity-45' : ''}`}
          >
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[15px] font-bold ${isToday(date) ? 'bg-[var(--accent-strong)] text-white shadow-sm' : index >= 5 ? 'text-[var(--rose)]' : 'text-[var(--ink)]'}`}>{date.getDate()}</span>
            {allDone && <Check size={12} strokeWidth={3} className="shrink-0 text-[var(--accent-strong)]" aria-label="全部完成" />}
          </button>
        )
      })}
    </div>
  )
}

interface CalendarTaskRowProps {
  week: Date[]
  month: Date
  tasksByDate: Map<string, Task[]>
  planDaysByDate: Map<string, PlanDay>
  selectedDate?: string
  onSelect: (date: string) => void
  onToggle: (id: string, completed: boolean) => Promise<void>
}

function CalendarTaskRow({ week, month, tasksByDate, planDaysByDate, selectedDate, onSelect, onToggle }: CalendarTaskRowProps) {
  return (
    <div className="calendar-grid grid min-w-0">
      {week.map((date, index) => {
        const key = keyForDate(date)
        const tasks = tasksByDate.get(key) ?? []
        const planDay = planDaysByDate.get(key)
        const selected = key === selectedDate
        const overflow = tasks.length > MAX_LINES
        const visible = overflow ? tasks.slice(0, MAX_LINES - 1) : tasks
        const hasSpareLine = visible.length + (overflow ? 1 : 0) < MAX_LINES
        const restEmpty = Boolean(planDay?.isRestDay) && tasks.length === 0
        return (
          <div
            key={key}
            onClick={() => onSelect(key)}
            className={`group relative h-[116px] min-w-0 cursor-pointer overflow-hidden px-2.5 py-2 transition hover:bg-[var(--surface-soft)] ${index < 6 ? 'border-r border-[var(--line)]' : ''} ${selected ? 'bg-[var(--accent-soft)]' : ''} ${restEmpty ? 'bg-[var(--rose-soft)]' : ''} ${!isSameMonth(date, month) ? 'opacity-45' : ''}`}
          >
            {restEmpty ? (
              <div className="flex h-full min-w-0 flex-col items-center justify-center gap-1 text-[var(--rose)]">
                <Moon size={16} aria-hidden="true" />
                <span className="text-[13px] font-semibold">休息日</span>
              </div>
            ) : (
              <>
                {visible.map((task) => <CalendarTaskItem key={task.id} task={task} onToggle={onToggle} />)}
                {overflow && <span className="block h-5 min-w-0 truncate text-[13px] font-semibold leading-5 text-[var(--muted)]">还有 {tasks.length - visible.length} 项</span>}
                {hasSpareLine && (
                  <span className="hidden h-5 min-w-0 items-center gap-1 text-[13px] leading-5 text-[var(--muted)] group-hover:flex">
                    <Plus size={12} className="shrink-0" aria-hidden="true" />添加计划
                  </span>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CalendarTaskItem({ task, onToggle }: { task: Task; onToggle: (id: string, completed: boolean) => Promise<void> }) {
  return (
    <span className="flex h-5 min-w-0 items-center gap-1.5">
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); void onToggle(task.id, !task.completed) }}
        aria-pressed={task.completed}
        aria-label={task.completed ? `取消完成 ${task.title}` : `完成 ${task.title}`}
        className="focus-ring grid h-5 w-4 shrink-0 place-items-center rounded"
      >
        {task.completed
          ? <SquareCheck size={14} strokeWidth={2.4} className="text-[var(--accent-strong)]" aria-hidden="true" />
          : <Square size={14} strokeWidth={2} className="text-[var(--muted)]" aria-hidden="true" />}
      </button>
      <span className={`min-w-0 flex-1 truncate text-[14px] leading-5 ${task.completed ? 'text-[var(--muted)] opacity-70 line-through decoration-[var(--line)] decoration-1' : 'text-[var(--ink)]'}`}>{task.title}</span>
    </span>
  )
}
