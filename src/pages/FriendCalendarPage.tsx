import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Check, ChevronLeft, ChevronRight, Eye, Moon, RefreshCw, Square, SquareCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { LoadingState } from '../components/LoadingState'
import { DateCell } from '../features/calendar/MobileCalendar'
import { useFriendCalendar } from '../hooks/useFriendCalendar'
import { listProfilesByIds } from '../services/profiles'
import { getFriendNote } from '../services/friendNotes'
import type { PlanDay, Profile, Task } from '../types'
import { dateKeyFromParts, todayDateKey } from '../utils/date'

const weekDays = ['一', '二', '三', '四', '五', '六', '日']
const desktopWeekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const MAX_LINES = 5

function keyForDate(date: Date) { return dateKeyFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate()) }

export function FriendCalendarPage() {
  const { id = '' } = useParams()
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => todayDateKey())
  const [profile, setProfile] = useState<Profile | null>(null)
  const [friendRemark, setFriendRemark] = useState('')
  const data = useFriendCalendar(id, month)

  useEffect(() => {
    let active = true
    listProfilesByIds([id]).then((list) => { if (active) setProfile(list[0] ?? null) }).catch(() => { /* handled by calendar error state */ })
    getFriendNote(id).then((note) => { if (active) setFriendRemark(note?.remark ?? '') }).catch(() => { /* profile name remains available */ })
    return () => { active = false }
  }, [id])

  const completed = useMemo(() => data.tasks.filter((task) => task.completed).length, [data.tasks])
  const rate = data.tasks.length ? Math.round((completed / data.tasks.length) * 100) : 0
  const selectedTasks = data.tasksByDate.get(selectedDate) ?? []
  const selectedPlanDay = data.planDaysByDate.get(selectedDate)
  const goToday = () => { const now = new Date(); setMonth(startOfMonth(now)); setSelectedDate(todayDateKey(now)) }
  const friendName = friendRemark || profile?.displayName || '好友'

  return (
    <div className="gentle-enter min-w-0">
      <div className="mb-3 flex min-w-0 items-center gap-2 rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--accent-strong)] sm:text-sm" role="note">
        <Eye size={15} aria-hidden="true" />好友日历 · 只读，你不能修改对方的计划
      </div>

      <header className="mb-3 grid min-w-0 gap-2.5 sm:mb-5 sm:gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0">
          <Link to="/friends" className="focus-ring mb-1 inline-flex items-center gap-1 rounded-lg text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--ink)] sm:text-sm">← 返回好友列表</Link>
          <div className="flex min-w-0 items-center gap-3">
            {profile?.avatarUrl
              ? <img src={profile.avatarUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover sm:h-12 sm:w-12" />
              : <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-lg font-bold text-[var(--accent-strong)] sm:h-12 sm:w-12">{profile?.displayName?.trim().charAt(0).toUpperCase() || '?'}</span>}
            <div className="min-w-0">
              <h1 className="truncate text-[22px] font-bold tracking-[-0.03em] sm:text-4xl">{friendName}</h1>
              <p className="truncate text-xs text-[var(--muted)] sm:text-sm">{friendRemark ? `${profile?.displayName ?? '好友'} · ${profile?.friendCode ?? ''}` : profile?.friendCode}</p>
            </div>
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-[40px_40px_minmax(0,1fr)] gap-1.5 sm:flex sm:gap-2">
          <button className="focus-ring grid h-11 w-10 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] sm:w-11" onClick={() => setMonth((value) => addMonths(value, -1))} aria-label="上一个月"><ChevronLeft size={20} /></button>
          <button className="focus-ring grid h-11 w-10 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] sm:w-11" onClick={() => setMonth((value) => addMonths(value, 1))} aria-label="下一个月"><ChevronRight size={20} /></button>
          <Button variant="secondary" className="min-w-0 whitespace-nowrap px-2 text-xs sm:px-4 sm:text-sm" onClick={goToday}>回到今天</Button>
        </div>
      </header>

      <p className="mb-3 text-xs text-[var(--muted)] sm:text-sm">{format(month, 'yyyy年M月', { locale: zhCN })}：共 {data.tasks.length} 项任务，完成 {completed} 项，完成率 {rate}%</p>

      {data.error && <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--rose-soft)] px-4 py-3 text-sm text-[var(--rose)]" role="alert"><span className="min-w-0 flex-1 break-words">{data.error}</span><Button variant="secondary" className="shrink-0" icon={<RefreshCw size={16} />} onClick={() => data.reload()}>重新加载</Button></div>}

      {data.loading ? (
        <LoadingState label="正在加载好友日历..." />
      ) : data.allowed === false ? (
        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">该好友暂未向你开放日历。</div>
      ) : (
        <div className="relative min-w-0">
          <div className="lg:hidden">
            <ReadOnlyMobileCalendar month={month} tasksByDate={data.tasksByDate} planDaysByDate={data.planDaysByDate} selectedDate={selectedDate} onSelect={setSelectedDate} />
            <ReadOnlyDayList date={selectedDate} tasks={selectedTasks} planDay={selectedPlanDay} />
          </div>
          <div className="hidden lg:block">
            <ReadOnlyPoster month={month} tasksByDate={data.tasksByDate} planDaysByDate={data.planDaysByDate} />
          </div>
        </div>
      )}
    </div>
  )
}

interface ReadOnlyCalendarProps {
  month: Date
  tasksByDate: Map<string, Task[]>
  planDaysByDate: Map<string, PlanDay>
}

function ReadOnlyMobileCalendar({ month, tasksByDate, planDaysByDate, selectedDate, onSelect }: ReadOnlyCalendarProps & { selectedDate: string; onSelect: (date: string) => void }) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
      <div className="calendar-grid grid w-full min-w-0 border-b border-[var(--line)] bg-[var(--surface-soft)]">
        {weekDays.map((day, index) => <div key={day} className={`min-w-0 py-2 text-center text-xs font-semibold ${index > 4 ? 'text-[var(--rose)]' : 'text-[var(--muted)]'}`}>{day}</div>)}
      </div>
      <div className="calendar-grid grid w-full min-w-0">
        {days.map((date) => {
          const key = keyForDate(date)
          return <DateCell key={key} date={date} month={month} tasks={tasksByDate.get(key) ?? []} rest={Boolean(planDaysByDate.get(key)?.isRestDay)} selected={key === selectedDate} onSelect={onSelect} />
        })}
      </div>
    </div>
  )
}

function ReadOnlyDayList({ date, tasks, planDay }: { date: string; tasks: Task[]; planDay?: PlanDay }) {
  const completed = tasks.filter((task) => task.completed).length
  return (
    <section className="surface mt-3 min-w-0 rounded-2xl p-4">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2 className="min-w-0 truncate text-base font-bold">{format(parseISO(date), 'M月d日 EEEE', { locale: zhCN })}</h2>
        {planDay?.isRestDay && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--rose-soft)] px-2 py-1 text-[11px] font-semibold text-[var(--rose)]"><Moon size={11} aria-hidden="true" />休息日</span>}
      </div>
      <p className="mt-0.5 text-xs text-[var(--muted)]">{tasks.length ? `完成 ${completed}/${tasks.length} 项` : '这一天没有计划'}</p>
      {tasks.length > 0 && (
        <div className="mt-3 grid min-w-0 gap-2" aria-label="好友当天任务（只读）">
          {tasks.map((task) => (
            <div key={task.id} className="flex min-w-0 items-start gap-2 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
              <span className={`mt-0.5 shrink-0 ${task.completed ? 'text-[var(--accent-strong)]' : 'text-[var(--muted)]'}`} aria-hidden="true">
                {task.completed ? <SquareCheck size={17} strokeWidth={2.4} /> : <Square size={16} strokeWidth={2} />}
              </span>
              <span className={`min-w-0 flex-1 text-[15px] font-medium leading-[22px] ${task.completed ? 'text-[var(--muted)] opacity-70 line-through decoration-[var(--line)] decoration-1' : 'text-[var(--ink)]'}`}>
                <span className="line-clamp-2 min-w-0 break-words">{task.title}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ReadOnlyPoster({ month, tasksByDate, planDaysByDate }: ReadOnlyCalendarProps) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })
  const weeks: Date[][] = []
  for (let index = 0; index < days.length; index += 7) weeks.push(days.slice(index, index + 7))

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-[var(--surface)]">
      <div className="calendar-grid grid min-w-0 border-b border-[var(--line-strong)] bg-[var(--surface-soft)]">
        {desktopWeekDays.map((label, index) => (
          <div key={label} className={`grid h-11 min-w-0 place-items-center text-[13px] font-semibold tracking-wide ${index > 4 ? 'text-[var(--rose)]' : 'text-[var(--muted)]'}`}>{label}</div>
        ))}
      </div>
      {weeks.map((week, weekIndex) => (
        <div key={keyForDate(week[0])} className={weekIndex === weeks.length - 1 ? undefined : 'border-b border-[var(--line-strong)]'}>
          <div className="calendar-grid grid min-w-0 border-b border-[var(--line-strong)]">
            {week.map((date) => {
              const key = keyForDate(date)
              const tasks = tasksByDate.get(key) ?? []
              const completed = tasks.filter((task) => task.completed).length
              const allDone = tasks.length > 0 && completed === tasks.length
              return (
                <div key={key} className={`flex h-9 min-w-0 items-center justify-center gap-1 ${!isSameMonth(date, month) ? 'opacity-45' : ''}`}>
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[15px] font-bold ${isToday(date) ? 'bg-[var(--accent-strong)] text-white shadow-sm' : date.getDay() === 0 || date.getDay() === 6 ? 'text-[var(--rose)]' : 'text-[var(--ink)]'}`}>{date.getDate()}</span>
                  {allDone && <Check size={12} strokeWidth={3} className="shrink-0 text-[var(--accent-strong)]" aria-label="全部完成" />}
                </div>
              )
            })}
          </div>
          <div className="calendar-grid grid min-w-0">
            {week.map((date, index) => {
              const key = keyForDate(date)
              const tasks = tasksByDate.get(key) ?? []
              const restEmpty = Boolean(planDaysByDate.get(key)?.isRestDay) && tasks.length === 0
              const overflow = tasks.length > MAX_LINES
              const visible = overflow ? tasks.slice(0, MAX_LINES - 1) : tasks
              return (
                <div key={key} className={`h-[116px] min-w-0 overflow-hidden px-2.5 py-2 ${index < 6 ? 'border-r border-[var(--line)]' : ''} ${!isSameMonth(date, month) ? 'opacity-45' : ''}`}>
                  {restEmpty ? (
                    <div className="flex h-full min-w-0 flex-col items-center justify-center gap-1 text-[var(--rose)]">
                      <Moon size={16} aria-hidden="true" />
                      <span className="text-[13px] font-semibold">休息日</span>
                    </div>
                  ) : (
                    <>
                      {visible.map((task) => (
                        <span key={task.id} className="flex h-5 min-w-0 items-center gap-1.5">
                          <span className={`shrink-0 ${task.completed ? 'text-[var(--accent-strong)]' : 'text-[var(--muted)]'}`} aria-hidden="true">
                            {task.completed ? <SquareCheck size={14} strokeWidth={2.4} /> : <Square size={14} strokeWidth={2} />}
                          </span>
                          <span className={`min-w-0 flex-1 truncate text-[14px] leading-5 ${task.completed ? 'text-[var(--muted)] opacity-70 line-through decoration-[var(--line)] decoration-1' : 'text-[var(--ink)]'}`}>{task.title}</span>
                        </span>
                      ))}
                      {overflow && <span className="block h-5 min-w-0 truncate text-[13px] font-semibold leading-5 text-[var(--muted)]">还有 {tasks.length - visible.length} 项</span>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
