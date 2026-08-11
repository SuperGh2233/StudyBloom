import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Check, Moon, Plus, Square, SquareCheck, Timer } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { PlanDay, Task } from '../../types'
import { dateKeyFromParts, todayDateKey } from '../../utils/date'

const weekDays = ['一', '二', '三', '四', '五', '六', '日']

function keyForDate(date: Date) { return dateKeyFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate()) }

interface MobileCalendarProps {
  month: Date
  tasksByDate: Map<string, Task[]>
  planDaysByDate: Map<string, PlanDay>
  selectedDate: string
  onSelect: (date: string) => void
  onToggle: (id: string, completed: boolean) => Promise<void>
  onOpenEditor: (date: string) => void
}

/** Phone layout: compact date-only month grid for picking a day, full task list below it. */
export function MobileCalendarView({ month, tasksByDate, planDaysByDate, selectedDate, onSelect, onToggle, onOpenEditor }: MobileCalendarProps) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })
  const tasks = tasksByDate.get(selectedDate) ?? []
  const planDay = planDaysByDate.get(selectedDate)

  return (
    <div className="min-w-0">
      <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="calendar-grid grid w-full min-w-0 border-b border-[var(--line)] bg-[var(--surface-soft)]">
          {weekDays.map((day, index) => <div key={day} className={`min-w-0 py-2 text-center text-xs font-semibold ${index > 4 ? 'text-[var(--rose)]' : 'text-[var(--muted)]'}`}>{day}</div>)}
        </div>
        <div className="calendar-grid grid w-full min-w-0">
          {days.map((date) => (
            <DateCell
              key={keyForDate(date)}
              date={date}
              month={month}
              tasks={tasksByDate.get(keyForDate(date)) ?? []}
              rest={Boolean(planDaysByDate.get(keyForDate(date))?.isRestDay)}
              selected={keyForDate(date) === selectedDate}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
      <MobileDayTaskList date={selectedDate} tasks={tasks} planDay={planDay} onToggle={onToggle} onOpenEditor={onOpenEditor} />
    </div>
  )
}

export function DateCell({ date, month, tasks, rest, selected, onSelect }: { date: Date; month: Date; tasks: Task[]; rest: boolean; selected: boolean; onSelect: (date: string) => void }) {
  const key = keyForDate(date)
  const completed = tasks.filter((task) => task.completed).length
  const allDone = tasks.length > 0 && completed === tasks.length
  const muted = !isSameMonth(date, month)
  const weekend = date.getDay() === 0 || date.getDay() === 6
  const statusLabel = tasks.length === 0
    ? (rest ? '休息日' : '暂无任务')
    : allDone ? '全部完成' : `完成 ${completed}/${tasks.length}`
  return (
    <button
      type="button"
      onClick={() => onSelect(key)}
      aria-label={`${format(date, 'M月d日 EEEE', { locale: zhCN })}，${statusLabel}`}
      aria-pressed={selected}
      className={`focus-ring flex h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden p-0.5 transition hover:bg-[var(--surface-soft)] ${selected ? 'bg-[var(--accent-soft)] ring-1 ring-inset ring-[var(--accent)]' : ''} ${muted ? 'opacity-40' : ''}`}
    >
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[14px] font-bold ${isToday(date) ? 'bg-[var(--accent-strong)] text-white shadow-sm' : weekend ? 'text-[var(--rose)]' : 'text-[var(--ink)]'}`}>{date.getDate()}</span>
      <span className="grid h-3.5 min-w-0 place-items-center" aria-hidden="true">
        {tasks.length === 0 ? (
          rest ? <span className="text-[10px] font-semibold leading-none text-[var(--rose)]">休</span> : null
        ) : allDone ? (
          <Check size={12} strokeWidth={3} className="text-[var(--accent-strong)]" />
        ) : completed > 0 ? (
          <span className="text-[10px] font-semibold leading-none text-[var(--muted)]">{completed}/{tasks.length}</span>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] opacity-70" />
        )}
      </span>
    </button>
  )
}

function MobileDayTaskList({ date, tasks, planDay, onToggle, onOpenEditor }: { date: string; tasks: Task[]; planDay?: PlanDay; onToggle: (id: string, completed: boolean) => Promise<void>; onOpenEditor: (date: string) => void }) {
  const navigate = useNavigate()
  const isToday = date === todayDateKey()
  const completed = tasks.filter((task) => task.completed).length
  const openEditor = () => onOpenEditor(date)
  return (
    <section className="surface mt-3 min-w-0 rounded-2xl p-4">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-base font-bold">{format(parseISO(date), 'M月d日 EEEE', { locale: zhCN })}</h2>
        {planDay?.isRestDay && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--rose-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--rose)]"><Moon size={11} aria-hidden="true" />休息日</span>}
      </div>
      <p className="mt-0.5 text-xs text-[var(--muted)]">{tasks.length ? `完成 ${completed}/${tasks.length} 项` : '这一天还没有计划'}</p>

      {tasks.length > 0 && (
        <div className="mt-3 grid min-w-0 gap-2" aria-label="当天任务列表">
          {tasks.map((task) => (
            <div key={task.id} className="flex min-w-0 items-start overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
              <button
                type="button"
                onClick={() => void onToggle(task.id, !task.completed)}
                aria-pressed={task.completed}
                aria-label={task.completed ? `取消完成 ${task.title}` : `完成 ${task.title}`}
                className={`focus-ring grid h-11 w-10 shrink-0 place-items-center self-stretch ${task.completed ? 'text-[var(--accent-strong)]' : 'text-[var(--muted)]'}`}
              >
                {task.completed ? <SquareCheck size={19} strokeWidth={2.4} /> : <Square size={18} strokeWidth={2} />}
              </button>
              <button
                type="button"
                onClick={openEditor}
                aria-label={`编辑 ${task.title}`}
                className={`focus-ring min-w-0 flex-1 px-1 py-2.5 text-left text-[15px] font-medium leading-[22px] ${task.completed ? 'text-[var(--muted)] opacity-70 line-through decoration-[var(--line)] decoration-1' : 'text-[var(--ink)]'}`}
              >
                <span className="line-clamp-2 min-w-0 break-words">{task.title}</span>
              </button>
              {isToday && (
                <button
                  type="button"
                  onClick={() => navigate(`/study?task=${task.id}`)}
                  aria-label={`开始学习 ${task.title}`}
                  className="focus-ring grid h-11 w-11 shrink-0 place-items-center self-center rounded-xl text-[var(--accent-strong)] transition hover:bg-[var(--accent-soft)]"
                >
                  <Timer size={19} strokeWidth={1.9} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {planDay?.note && <p className="mt-3 line-clamp-2 min-w-0 break-words rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-sm leading-6 text-[var(--muted)]">{planDay.note}</p>}

      <button
        type="button"
        onClick={openEditor}
        className="focus-ring mt-3 flex min-h-11 w-full min-w-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--line)] text-sm font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--accent-soft)]"
      >
        <Plus size={16} aria-hidden="true" />添加计划
      </button>
    </section>
  )
}
