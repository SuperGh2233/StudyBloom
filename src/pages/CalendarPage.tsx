import { addMonths, format, startOfMonth } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Leaf, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/ToastProvider'
import { DesktopCalendar } from '../features/calendar/DesktopCalendar'
import { MobileCalendarView } from '../features/calendar/MobileCalendar'
import { DayEditor } from '../features/tasks/DayEditor'
import { useMonthPlans } from '../hooks/useMonthPlans'
import { todayDateKey } from '../utils/date'
import { getErrorMessage } from '../utils/errorMessage'

export function CalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => todayDateKey())
  const [editorOpen, setEditorOpen] = useState(false)
  const data = useMonthPlans(month)
  const { showToast } = useToast()
  const toggleFromCalendar = (id: string, completed: boolean) => data.toggleTask(id, completed).catch((error) => { showToast(getErrorMessage(error, '更新任务失败'), 'error') })
  const completed = useMemo(() => data.tasks.filter((task) => task.completed).length, [data.tasks])
  const rate = data.tasks.length ? Math.round((completed / data.tasks.length) * 100) : 0
  const selectedTasks = data.tasksByDate.get(selectedDate) ?? []
  const selectedPlanDay = data.planDaysByDate.get(selectedDate)
  const openEditor = (key: string) => { setSelectedDate(key); setEditorOpen(true) }

  const goToday = () => { const now = new Date(); setMonth(startOfMonth(now)); setSelectedDate(todayDateKey(now)) }

  return (
    <div className="gentle-enter min-w-0">
      <header className="mb-3 grid min-w-0 gap-2.5 sm:mb-5 sm:gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="min-w-0">
          <p className="mb-0.5 flex items-center gap-2 text-xs font-semibold text-[var(--accent-strong)] sm:mb-1 sm:text-sm"><Leaf size={16} />本月计划</p>
          <h1 className="truncate text-[22px] font-bold tracking-[-0.03em] sm:text-4xl">{format(month, 'yyyy年M月', { locale: zhCN })}</h1>
          <p className="mt-1 text-xs text-[var(--muted)] sm:mt-1.5 sm:text-sm">完成 {completed}/{data.tasks.length} 项，本月完成率 {rate}%</p>
        </div>
        <div className="grid min-w-0 grid-cols-[40px_40px_minmax(0,1fr)] gap-1.5 sm:flex sm:gap-2">
          <button className="focus-ring grid h-11 w-10 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] sm:w-11" onClick={() => setMonth((value) => addMonths(value, -1))} aria-label="上一个月"><ChevronLeft size={20} /></button>
          <button className="focus-ring grid h-11 w-10 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] sm:w-11" onClick={() => setMonth((value) => addMonths(value, 1))} aria-label="下一个月"><ChevronRight size={20} /></button>
          <Button variant="secondary" className="min-w-0 whitespace-nowrap px-2 text-xs sm:px-4 sm:text-sm" onClick={goToday}>回到今天</Button>
        </div>
      </header>

      {data.error && <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--rose-soft)] px-4 py-3 text-sm text-[var(--rose)]" role="alert"><span className="min-w-0 flex-1 break-words">{data.error}</span><Button variant="secondary" className="shrink-0" icon={<RefreshCw size={16} />} onClick={() => data.reload()}>重新加载</Button></div>}

      <div className="relative min-w-0">
        {data.loading && <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] backdrop-blur-[2px]" role="status"><span className="rounded-xl bg-[var(--surface)] px-4 py-3 text-sm font-semibold shadow">正在加载本月计划...</span></div>}
        <div className="lg:hidden">
          <MobileCalendarView month={month} tasksByDate={data.tasksByDate} planDaysByDate={data.planDaysByDate} selectedDate={selectedDate} onSelect={setSelectedDate} onToggle={toggleFromCalendar} onOpenEditor={openEditor} />
        </div>
        <div className="hidden lg:block">
          <DesktopCalendar month={month} tasksByDate={data.tasksByDate} planDaysByDate={data.planDaysByDate} selectedDate={selectedDate} onSelect={openEditor} onToggle={toggleFromCalendar} />
        </div>
      </div>

      {!data.loading && !data.error && data.tasks.length === 0 && data.planDays.length === 0 && <div className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)]"><EmptyState title="这个月还没有计划" description="点击日历中的任意一天，写下第一件准备完成的小事。" /></div>}

      <DayEditor
        open={editorOpen}
        date={selectedDate}
        tasks={selectedTasks}
        planDay={selectedPlanDay}
        onClose={() => setEditorOpen(false)}
        onAdd={data.addTask}
        onUpdate={data.updateTask}
        onToggle={data.toggleTask}
        onDelete={data.removeTask}
        onMove={data.moveTask}
        onSavePlanDay={data.savePlanDay}
        onCopy={data.copyDay}
      />
    </div>
  )
}
