import { addMonths, format, startOfMonth } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Leaf, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { CalendarGrid } from '../features/calendar/CalendarGrid'
import { DayEditor } from '../features/tasks/DayEditor'
import { useMonthPlans } from '../hooks/useMonthPlans'
import { todayDateKey } from '../utils/date'

export function CalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState('')
  const data = useMonthPlans(month)
  const completed = useMemo(() => data.tasks.filter((task) => task.completed).length, [data.tasks])
  const rate = data.tasks.length ? Math.round((completed / data.tasks.length) * 100) : 0
  const selectedTasks = selectedDate ? data.tasksByDate.get(selectedDate) ?? [] : []
  const selectedPlanDay = selectedDate ? data.planDaysByDate.get(selectedDate) : undefined

  const goToday = () => { const now = new Date(); setMonth(startOfMonth(now)); setSelectedDate(todayDateKey(now)) }

  return (
    <div className="gentle-enter">
      <header className="mb-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm font-semibold text-[var(--accent-strong)]"><Leaf size={16} />本月计划</p>
          <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">{format(month, 'yyyy年 M月', { locale: zhCN })}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">完成 {completed}/{data.tasks.length} 项，本月完成率 {rate}%</p>
        </div>
        <div className="grid grid-cols-[44px_44px_1fr] gap-2 sm:flex">
          <button className="focus-ring grid h-11 w-11 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)]" onClick={() => setMonth((value) => addMonths(value, -1))} aria-label="上一个月"><ChevronLeft size={20} /></button>
          <button className="focus-ring grid h-11 w-11 place-items-center rounded-xl border border-[var(--line)] bg-[var(--surface)]" onClick={() => setMonth((value) => addMonths(value, 1))} aria-label="下一个月"><ChevronRight size={20} /></button>
          <Button variant="secondary" onClick={goToday}>回到今天</Button>
        </div>
      </header>

      {data.error && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--rose-soft)] px-4 py-3 text-sm text-[var(--rose)]" role="alert"><span>{data.error}</span><Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => data.reload()}>重新加载</Button></div>}

      <div className="relative">
        {data.loading && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--surface)_72%,transparent)] backdrop-blur-[2px]" role="status"><span className="rounded-xl bg-[var(--surface)] px-4 py-3 text-sm font-semibold shadow">正在加载本月计划...</span></div>
        )}
        <CalendarGrid month={month} tasksByDate={data.tasksByDate} planDaysByDate={data.planDaysByDate} selectedDate={selectedDate} onSelect={setSelectedDate} />
      </div>

      {!data.loading && !data.error && data.tasks.length === 0 && data.planDays.length === 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)]"><EmptyState title="这个月还没有计划" description="点击日历中的任意一天，写下第一件准备完成的小事。" /></div>
      )}

      <DayEditor
        open={Boolean(selectedDate)}
        date={selectedDate || todayDateKey()}
        tasks={selectedTasks}
        planDay={selectedPlanDay}
        onClose={() => setSelectedDate('')}
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
