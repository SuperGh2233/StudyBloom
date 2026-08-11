import { eachDayOfInterval, format, parseISO, subDays } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { CalendarCheck2, CalendarDays, CheckCircle2, Clock, Flame, ListChecks, Medal, PlayCircle, RefreshCw, Repeat, Sparkles, Target, Trophy } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '../components/Button'
import { EmptyState } from '../components/EmptyState'
import { LoadingState } from '../components/LoadingState'
import { getMonthlyStatistics } from '../services/statistics'
import { getStudyTimeStatistics } from '../services/studyStatistics'
import type { StudyRangeKind, StudyStatisticsView } from '../services/studyStatistics'
import type { MonthlyStatistics } from '../types'
import { getErrorMessage } from '../utils/errorMessage'
import { formatDurationHuman } from '../utils/studyDuration'
import { todayDateKey } from '../utils/date'

const RANGE_OPTIONS: { kind: StudyRangeKind; label: string }[] = [
  { kind: 'today', label: '今天' },
  { kind: 'week', label: '本周' },
  { kind: 'month', label: '本月' },
]

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

  const [kind, setKind] = useState<StudyRangeKind>('today')
  const [studyView, setStudyView] = useState<StudyStatisticsView | null>(null)
  const [studyLoading, setStudyLoading] = useState(true)
  const [studyError, setStudyError] = useState('')
  const [studyReload, setStudyReload] = useState(0)

  useEffect(() => {
    let stale = false
    setStudyLoading(true); setStudyError('')
    getStudyTimeStatistics(kind)
      .then((result) => { if (!stale) setStudyView(result) })
      .catch((reason) => { if (!stale) setStudyError(getErrorMessage(reason, '学习时长加载失败')) })
      .finally(() => { if (!stale) setStudyLoading(false) })
    return () => { stale = true }
  }, [kind, studyReload])

  const lastSeven = useMemo(() => {
    if (!stats) return []
    const today = parseISO(todayDateKey())
    const map = new Map(stats.days.map((day) => [day.date, day]))
    return eachDayOfInterval({ start: subDays(today, 6), end: today }).map((date) => ({ date, data: map.get(format(date, 'yyyy-MM-dd')) }))
  }, [stats])

  const lastSevenStudy = useMemo(() => {
    return (studyView?.lastSevenDays ?? []).map((day) => ({ date: parseISO(day.date), data: day }))
  }, [studyView])
  const maxDaySeconds = lastSevenStudy.reduce((max, day) => Math.max(max, day.data?.seconds ?? 0), 0)
  const studyEmpty = studyView
    ? studyView.metrics.totalSeconds === 0 && studyView.metrics.sessionCount === 0 && studyView.lastSevenDays.every((day) => day.seconds === 0)
    : false

  if (loading) return <LoadingState label="正在整理学习记录..." />

  return (
    <div className="gentle-enter">
      <header className="mb-6">
        <p className="text-sm font-semibold text-[var(--accent-strong)]">学习统计</p>
        <h1 className="mt-1 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">看见坚持的痕迹</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">{format(new Date(), 'yyyy年 M月', { locale: zhCN })}的数据会在这里慢慢积累。</p>
        <p className="mt-1 text-sm text-[var(--muted)]">每一段投入的学习时长，也会在这里留下痕迹。</p>
      </header>

      <section className="surface rounded-2xl p-5 sm:p-6" aria-label="学习时长统计">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">学习时长</h2>
          <div role="group" aria-label="统计时间范围" className="grid w-full grid-cols-3 gap-1 rounded-xl bg-[var(--surface-soft)] p-1 sm:w-60">
            {RANGE_OPTIONS.map((option) => (
              <button key={option.kind} type="button" aria-pressed={kind === option.kind} onClick={() => setKind(option.kind)} className={`focus-ring min-h-11 min-w-0 rounded-lg text-sm font-semibold transition ${kind === option.kind ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>{option.label}</button>
            ))}
          </div>
        </div>

        {studyLoading ? (
          <LoadingState label="正在整理学习时长..." />
        ) : studyError ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--rose-soft)] p-4 text-sm text-[var(--rose)]"><span>{studyError}</span><Button variant="secondary" icon={<RefreshCw size={16} />} onClick={() => setStudyReload((count) => count + 1)}>重试</Button></div>
        ) : studyEmpty ? (
          <p className="mt-4 rounded-xl bg-[var(--surface-soft)] px-4 py-8 text-center text-sm text-[var(--muted)]">这个时间段还没有学习记录。</p>
        ) : studyView && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Metric icon={Clock} label="总学习时长" value={formatDurationHuman(studyView.metrics.totalSeconds)} />
              <Metric icon={CalendarDays} label="日均" value={formatDurationHuman(studyView.metrics.averageDailySeconds)} />
              <Metric icon={PlayCircle} label="学习次数" value={studyView.metrics.sessionCount} />
              <Metric icon={Medal} label="最长单次" value={formatDurationHuman(studyView.metrics.longestSessionSeconds)} />
              <Metric icon={Sparkles} label="自由学习" value={formatDurationHuman(studyView.metrics.freeSeconds)} />
              <Metric icon={Target} label="番茄专注" value={formatDurationHuman(studyView.metrics.focusSeconds)} />
              <Metric icon={Repeat} label="完成番茄轮数" value={studyView.metrics.completedPomodoroRounds} />
            </div>

            <h3 className="mt-6 text-base font-bold">最近七天</h3>
            <div className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-3">
              {lastSevenStudy.map(({ date, data }) => {
                const seconds = data?.seconds ?? 0
                const rounds = data?.pomodoroRounds ?? 0
                return (
                  <div key={date.toISOString()} role="img" aria-label={`${format(date, 'M月d日', { locale: zhCN })}学习${formatDurationHuman(seconds)}${rounds ? `，完成 ${rounds} 轮番茄` : ''}`} className="grid min-w-0 justify-items-center gap-1.5">
                    <div className="flex h-24 w-full items-end justify-center sm:h-28">
                      {seconds > 0
                        ? <div className="w-full max-w-[30px] rounded-md bg-[var(--accent-strong)]" style={{ height: `${Math.max(8, Math.round((seconds / maxDaySeconds) * 100))}%` }} />
                        : <div className="h-0.5 w-full max-w-[30px] rounded-full bg-[var(--surface-soft)]" />}
                    </div>
                    <span className="text-[10px] font-semibold text-[var(--accent-strong)] sm:text-xs">{rounds > 0 ? `${rounds} 轮` : ' '}</span>
                    <span className="text-[10px] text-[var(--muted)] sm:text-xs">{format(date, 'EEE', { locale: zhCN })}</span>
                  </div>
                )
              })}
            </div>

            {studyView.metrics.byTask.length > 0 && (
              <>
                <h3 className="mt-6 text-base font-bold">按任务统计</h3>
                <ul className="mt-3 grid gap-2">
                  {studyView.metrics.byTask.map((task) => (
                    <li key={task.taskTitle} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-[var(--surface-soft)] px-4 py-3 text-sm">
                      <span className="min-w-0 truncate font-medium">{task.taskTitle}</span>
                      <span className="shrink-0 text-[var(--muted)]">{formatDurationHuman(task.seconds)}{task.pomodoroRounds > 0 ? ` · ${task.pomodoroRounds} 轮` : ''}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      {error && <div className="mt-5 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--rose-soft)] p-4 text-sm text-[var(--rose)]"><span>{error}</span><Button variant="secondary" icon={<RefreshCw size={16} />} onClick={load}>重试</Button></div>}

      {!error && stats && stats.totalTaskCount === 0 ? (
        <div className="surface mt-5 rounded-2xl"><EmptyState title="本月还没有统计数据" description="完成第一项计划后，这里会展示完成率和完成记录。" /></div>
      ) : stats && (
        <>
          <section className="surface mt-5 grid gap-5 rounded-2xl p-5 sm:p-7 lg:grid-cols-[220px_1fr] lg:items-center">
            <div className="mx-auto grid h-44 w-44 place-items-center rounded-full" style={{ background: `conic-gradient(var(--accent-strong) ${stats.completionRate}%, var(--surface-soft) 0)` }} aria-label={`本月完成率 ${stats.completionRate}%`}>
              <div className="grid h-32 w-32 place-items-center rounded-full bg-[var(--surface)] text-center">
                <div><strong className="block text-4xl tracking-tight">{Math.round(stats.completionRate)}%</strong><span className="text-xs text-[var(--muted)]">本月完成率</span></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              <Metric icon={ListChecks} label="任务总数" value={stats.totalTaskCount} />
              <Metric icon={CheckCircle2} label="已完成" value={stats.completedTaskCount} />
              <Metric icon={CalendarCheck2} label="有计划天数" value={stats.days.filter((day) => day.taskCount > 0).length} />
              <Metric icon={Trophy} label="全部完成天数" value={stats.allCompletedDays} />
            </div>
          </section>

          <section className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
            <div className="surface rounded-2xl p-5 sm:p-6">
              <h2 className="text-lg font-bold">连续完成</h2>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[var(--accent-soft)] p-4"><Flame className="text-[var(--accent-strong)]" size={22} /><strong className="mt-4 block text-3xl">{stats.currentStreak}</strong><span className="text-xs text-[var(--muted)]">当前连续天数</span></div>
                <div className="rounded-xl bg-[var(--rose-soft)] p-4"><Trophy className="text-[var(--rose)]" size={22} /><strong className="mt-4 block text-3xl">{stats.longestStreak}</strong><span className="text-xs text-[var(--muted)]">最长连续天数</span></div>
              </div>
              <p className="mt-4 text-xs leading-5 text-[var(--muted)]">当天至少有一项任务且全部完成，记为完成。休息日不增加天数，也不会中断连续记录。</p>
            </div>
            <div className="surface rounded-2xl p-5 sm:p-6">
              <h2 className="text-lg font-bold">最近七天</h2>
              <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-3">
                {lastSeven.map(({ date, data }) => {
                  const rate = data?.taskCount ? Math.round((data.completedTaskCount / data.taskCount) * 100) : 0
                  return <div key={date.toISOString()} className="grid min-w-0 justify-items-center gap-2 text-center"><span className={`grid h-9 w-full min-w-0 place-items-center rounded-xl text-[10px] font-bold sm:h-11 sm:text-xs ${data?.allCompleted ? 'bg-[var(--accent-strong)] text-white' : data?.isRestDay ? 'bg-[var(--rose-soft)] text-[var(--rose)]' : 'bg-[var(--surface-soft)] text-[var(--muted)]'}`}>{data?.isRestDay ? '休' : data?.taskCount ? `${rate}%` : '无'}</span><span className="text-[10px] text-[var(--muted)] sm:text-xs">{format(date, 'EEE', { locale: zhCN })}</span></div>
                })}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof ListChecks; label: string; value: string | number }) {
  return <div className="min-w-0 rounded-xl bg-[var(--surface-soft)] p-4"><Icon size={19} className="text-[var(--accent-strong)]" /><strong className="mt-3 block text-2xl leading-snug">{value}</strong><span className="text-xs text-[var(--muted)]">{label}</span></div>
}
