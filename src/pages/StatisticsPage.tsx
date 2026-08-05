import { eachDayOfInterval, format, parseISO, subDays } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { CalendarCheck2, CheckCircle2, Flame, ListChecks, RefreshCw, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { LoadingState } from '../components/LoadingState'
import { getMonthlyStatistics } from '../services/statistics'
import type { MonthlyStatistics } from '../types'
import { getErrorMessage } from '../utils/errorMessage'
import { todayDateKey } from '../utils/date'

export function StatisticsPage() {
  const [stats, setStats] = useState<MonthlyStatistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const monthKey = format(new Date(), 'yyyy-MM')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setStats(await getMonthlyStatistics(monthKey)) }
    catch (reason) { setError(getErrorMessage(reason, '统计数据加载失败')) }
    finally { setLoading(false) }
  }, [monthKey])
  useEffect(() => { void load() }, [load])

  const lastSeven = useMemo(() => {
    if (!stats) return []
    const today = parseISO(todayDateKey())
    const map = new Map(stats.days.map((day) => [day.date, day]))
    return eachDayOfInterval({ start: subDays(today, 6), end: today }).map((date) => ({ date, data: map.get(format(date, 'yyyy-MM-dd')) }))
  }, [stats])

  if (loading) return <LoadingState label="正在整理学习记录..." />

  return (
    <div className="gentle-enter">
      <header className="mb-6">
        <p className="text-sm font-semibold text-[var(--accent-strong)]">学习统计</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">看见坚持的痕迹</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{format(new Date(), 'yyyy年 M月', { locale: zhCN })}的数据会在这里慢慢积累。</p>
      </header>

      {error && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--rose-soft)] p-4 text-sm text-[var(--rose)]"><span>{error}</span><Button variant="secondary" icon={<RefreshCw size={16} />} onClick={load}>重试</Button></div>}

      {!error && stats && stats.totalTaskCount === 0 ? (
        <div className="surface rounded-2xl"><EmptyState title="本月还没有统计数据" description="完成第一项计划后，这里会展示完成率和打卡记录。" /></div>
      ) : stats && (
        <>
          <section className="surface grid gap-5 rounded-2xl p-5 sm:p-7 lg:grid-cols-[220px_1fr] lg:items-center">
            <div className="mx-auto grid h-44 w-44 place-items-center rounded-full" style={{ background: `conic-gradient(var(--accent-strong) ${stats.completionRate}%, var(--surface-soft) 0)` }} aria-label={`本月完成率 ${stats.completionRate}%`}>
              <div className="grid h-32 w-32 place-items-center rounded-full bg-[var(--surface)] text-center">
                <div><strong className="block text-4xl tracking-tight">{Math.round(stats.completionRate)}%</strong><span className="text-xs text-[var(--muted)]">本月完成率</span></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              <Metric icon={ListChecks} label="任务总数" value={stats.totalTaskCount} />
              <Metric icon={CheckCircle2} label="已完成" value={stats.completedTaskCount} />
              <Metric icon={CalendarCheck2} label="有计划天数" value={stats.days.filter((day) => day.taskCount > 0).length} />
              <Metric icon={Trophy} label="全部完成天数" value={stats.checkInDays} />
            </div>
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
            <div className="surface rounded-2xl p-5 sm:p-6">
              <h2 className="text-lg font-bold">连续打卡</h2>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[var(--accent-soft)] p-4"><Flame className="text-[var(--accent-strong)]" size={22} /><strong className="mt-4 block text-3xl">{stats.currentStreak}</strong><span className="text-xs text-[var(--muted)]">当前连续天数</span></div>
                <div className="rounded-xl bg-[var(--rose-soft)] p-4"><Trophy className="text-[var(--rose)]" size={22} /><strong className="mt-4 block text-3xl">{stats.longestStreak}</strong><span className="text-xs text-[var(--muted)]">最长连续天数</span></div>
              </div>
              <p className="mt-4 text-xs leading-5 text-[var(--muted)]">当天至少有一项任务且全部完成，记为打卡。休息日不增加天数，也不会中断连续记录。</p>
            </div>
            <div className="surface rounded-2xl p-5 sm:p-6">
              <h2 className="text-lg font-bold">最近七天</h2>
              <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-3">
                {lastSeven.map(({ date, data }) => {
                  const rate = data?.taskCount ? Math.round((data.completedTaskCount / data.taskCount) * 100) : 0
                  return <div key={date.toISOString()} className="grid min-w-0 justify-items-center gap-2 text-center"><span className={`grid h-9 w-full min-w-0 place-items-center rounded-xl text-[10px] font-bold sm:h-11 sm:text-xs ${data?.checkedIn ? 'bg-[var(--accent-strong)] text-white' : data?.isRestDay ? 'bg-[var(--rose-soft)] text-[var(--rose)]' : 'bg-[var(--surface-soft)] text-[var(--muted)]'}`}>{data?.isRestDay ? '休' : data?.taskCount ? `${rate}%` : '无'}</span><span className="text-[10px] text-[var(--muted)] sm:text-xs">{format(date, 'EEE', { locale: zhCN })}</span></div>
                })}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof ListChecks; label: string; value: number }) {
  return <div className="rounded-xl bg-[var(--surface-soft)] p-4"><Icon size={19} className="text-[var(--accent-strong)]" /><strong className="mt-3 block text-2xl">{value}</strong><span className="text-xs text-[var(--muted)]">{label}</span></div>
}
