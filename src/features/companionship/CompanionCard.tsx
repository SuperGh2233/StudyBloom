import { format, parseISO, subDays } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Flower2, HeartHandshake, RefreshCw, Settings2, Sprout, UserPlus } from 'lucide-react'
import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useToast } from '../../components/ToastProvider'
import type { useCompanionHome } from '../../hooks/useCompanionHome'
import { useCompanionWeekly } from '../../hooks/useCompanionWeekly'
import { formatDateKey } from '../../utils/date'
import { getErrorMessage } from '../../utils/errorMessage'
import { sharedBloomStreak } from './companionUtils'

type CompanionData = ReturnType<typeof useCompanionHome>

/** 送花时的飘散花朵：横向偏移与旋转角，营造自然散布感。 */
const BURST_ITEMS = [
  { fx: '-26px', fr: '-24deg', delay: '0ms', size: 18 },
  { fx: '10px', fr: '18deg', delay: '90ms', size: 14 },
  { fx: '-6px', fr: '-10deg', delay: '160ms', size: 20 },
  { fx: '24px', fr: '28deg', delay: '240ms', size: 13 },
  { fx: '-16px', fr: '12deg', delay: '320ms', size: 15 },
]

export function CompanionCard({ data }: { data: CompanionData }) {
  const { showToast } = useToast()
  const [burstKey, setBurstKey] = useState(0)
  const [sending, setSending] = useState(false)
  const weekly = useCompanionWeekly(data.data?.primaryCompanionId ?? null)

  const receivedFlowerCompanionId = data.data?.receivedToday ? data.data.primaryCompanionId : null
  const receivedFlowerCompanionName = data.data?.receivedToday ? data.data.primaryCompanionName : ''
  const receivedFlowerDate = data.data?.todayDate ?? ''
  useEffect(() => {
    if (!receivedFlowerCompanionId || !receivedFlowerDate) return
    try {
      const key = `studybloom:companion-flower-toast:${receivedFlowerCompanionId}:${receivedFlowerDate}`
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, '1')
    } catch { /* 隐私模式或存储不可用时仍提示，不阻塞首页 */ }
    showToast(`${receivedFlowerCompanionName || '学习搭子'} 今天送来一朵花`)
  }, [receivedFlowerCompanionId, receivedFlowerCompanionName, receivedFlowerDate, showToast])

  const sendFlower = async () => {
    if (sending) return
    setSending(true)
    try {
      await data.sendFlower()
      setBurstKey((key) => key + 1)
      showToast('小花已经送到')
    } catch (error) {
      showToast(getErrorMessage(error, '送花失败'), 'error')
    } finally {
      setSending(false)
    }
  }

  if (!data.data && (data.loading || !data.attempted)) return <CompanionSkeleton />

  if (!data.data && data.error) return (
    <section className="surface companion-card mt-3 rounded-2xl p-4 sm:p-5" aria-labelledby="companion-title">
      <Header />
      <p className="mt-3 text-sm text-[var(--muted)]">{typeof navigator !== 'undefined' && !navigator.onLine ? '当前处于离线状态，恢复网络后可以重新加载搭子动态。' : '暂时没取到搭子动态，不影响你的学习。'}</p>
      <p className="mt-2 break-words rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-xs leading-5 text-[var(--muted)]">原因：{data.error}</p>
      <Button variant="secondary" className="mt-3" icon={<RefreshCw size={16} />} onClick={() => data.reload()}>重新加载</Button>
    </section>
  )

  const state = data.data
  if (!state) return null

  if (!state.hasFriends) return (
    <section className="surface companion-card mt-3 rounded-2xl p-4 sm:p-5" aria-labelledby="companion-title">
      <Header />
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">邀请一位固定搭子。你们不必同时在线，也不会自动共享学习记录。</p>
      <Link className="focus-ring mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white" to="/friends"><UserPlus size={17} />邀请搭子</Link>
    </section>
  )

  if (!state.primaryCompanionId) return (
    <section className="surface companion-card mt-3 rounded-2xl p-4 sm:p-5" aria-labelledby="companion-title">
      <Header />
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">选择一位首页搭子。设置搭子不会自动开放任何学习数据。</p>
      <Link className="focus-ring mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] px-4 text-sm font-semibold text-[var(--accent-strong)]" to="/settings#companionship"><Settings2 size={17} />选择首页搭子</Link>
    </section>
  )

  const bloomDates = new Set(state.sharedBloomDates)
  const lastSevenDates = Array.from({ length: 7 }, (_, index) => formatDateKey(subDays(parseISO(state.todayDate), 6 - index)))
  const sharedToday = bloomDates.has(state.todayDate)
  const sentToday = state.sentToday
  const receivedToday = state.receivedToday
  const mutualToday = sentToday && receivedToday
  const streak = sharedBloomStreak(bloomDates, state.todayDate)
  const totalBloomDays = weekly.summary?.totalBloomDays ?? null
  const milestone = weekly.summary?.milestone ?? null
  return (
    <section className={`surface companion-card relative mt-3 overflow-hidden rounded-2xl p-4 sm:p-5 ${sharedToday ? 'companion-bloom' : ''}`} aria-labelledby="companion-title" aria-busy={data.refreshing}>
      {burstKey > 0 && (
        <span key={burstKey} className="flower-burst" aria-hidden="true">
          {BURST_ITEMS.map((item, index) => (
            <Flower2
              key={index}
              size={item.size}
              className="flower-burst-item"
              style={{ '--fx': item.fx, '--fr': item.fr, animationDelay: item.delay } as CSSProperties}
            />
          ))}
        </span>
      )}

      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0"><Header /><p className="mt-1 truncate text-sm font-semibold">你和 {state.primaryCompanionName}</p></div>
        <Link to="/settings#companionship" className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--muted)]" aria-label="管理搭子与分享"><Settings2 size={18} /></Link>
      </div>

      <div className="mt-4 min-w-0">
        {state.companionShareLevel === 'none' ? (
            <><p className="text-sm font-semibold">学习记录由 {state.primaryCompanionName} 自己掌握</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">分享由每个人自己决定。你仍然可以送出一朵表示陪伴的小花。</p></>
          ) : (
            <>
              {sharedToday && <p className="text-base font-bold text-[var(--accent-strong)]">你们今天都认真学习过，一起绽放了一天。</p>}
              {state.companionShareLevel === 'summary' && state.companionToday && (
                <p className="mt-1 text-xs text-[var(--muted)]">有效学习 {state.companionToday.studiedMinutes ?? 0} 分钟，完成 {state.companionToday.completedTasks ?? 0}/{state.companionToday.totalTasks ?? 0} 项任务</p>
              )}
              {state.companionShareLevel === 'bloom_only' && state.companionToday?.effectiveStudy && (
                <p className="text-sm font-semibold">{state.primaryCompanionName} 今天也为目标留出了一段时间。</p>
              )}
              {state.companionShareLevel !== 'summary' && !state.companionToday?.effectiveStudy && (
                <p className="text-sm text-[var(--muted)]">今天暂时没有可分享的记录。今天可以慢慢来，也可以安心休息。</p>
              )}
            </>
          )}
          {/* old implementation below is commented out
          <><p className="text-sm font-semibold">学习记录由 {state.primaryCompanionName} 自己掌握</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">分享由每个人自己决定。你仍然可以送出一朵表示陪伴的小花。</p></>
        ) : (
          <><p className="text-sm font-semibold">学习记录由 {state.primaryCompanionName} 自己掌握</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">分享由每个人自己决定。你仍然可以送出一朵表示陪伴的小花。</p></>
        {sharedToday && <p className="text-base font-bold text-[var(--accent-strong)]">你们今天都认真学习过，一起绽放了一天。</p>}
          <><p className="text-sm font-semibold">{state.primaryCompanionName} 今天也为目标留出了一段时间。</p>{state.companionShareLevel === 'summary' && <p className="mt-1 text-xs text-[var(--muted)]">有效学习 {state.companionToday.studiedMinutes ?? 0} 分钟，完成 {state.companionToday.completedTasks ?? 0}/{state.companionToday.totalTasks ?? 0} 项任务</p>}</>
        ) : (
          <p className="text-sm text-[var(--muted)]">今天暂时没有可分享的记录。今天可以慢慢来，也可以安心休息。</p>
        )}
          */}
      </div>

      {state.ownShareLevel === 'none' && <p className="mt-3 rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-xs leading-5 text-[var(--muted)]">你尚未向 {state.primaryCompanionName} 分享学习状态。开启“仅共同绽放”也不会暴露时长和任务。</p>}

      <div className="mt-4 grid grid-cols-7 gap-1.5" role="list" aria-label="最近七天共同绽放记录">
        {lastSevenDates.map((date) => {
          const bloomed = bloomDates.has(date)
          const dayDate = parseISO(date)
          const label = `${format(dayDate, 'M月d日 EEEE', { locale: zhCN })}，${bloomed ? '共同绽放' : '未共同绽放'}`
          return (
            <span
              key={date}
              role="listitem"
              aria-label={label}
              className={`grid min-w-0 justify-items-center gap-0.5 rounded-xl py-1.5 ${bloomed ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent)_35%,transparent)]' : 'bg-[var(--surface-soft)] text-[var(--muted)]'}`}
            >
              {bloomed ? <Flower2 size={18} strokeWidth={2} aria-hidden="true" /> : <Sprout size={14} strokeWidth={1.6} aria-hidden="true" className="opacity-60" />}
              <span className={`text-[10px] leading-none ${bloomed ? 'font-bold' : 'font-medium opacity-70'}`} aria-hidden="true">{dayDate.getDate()}</span>
            </span>
          )
        })}
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
                        本周一起学习了 {state.weekBloomDays} 天
            {streak > 1 && <span className="ml-2 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-xs font-bold text-[var(--accent-strong)]">连续 {streak} 天</span>}
          </p>
          {receivedToday && <p className="mt-0.5 text-xs text-[var(--rose)]">{mutualToday ? '今天你们互相送了一朵花' : `${state.primaryCompanionName} 今天送来一朵花`}</p>}
          {totalBloomDays !== null && totalBloomDays > 0 && (
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              累计一起绽放 {totalBloomDays} 天{milestone ? `，已点亮 ${milestone} 天里程碑` : ''}
            </p>
          )}
        </div>
        <Button className="shrink-0" variant={sentToday ? 'secondary' : 'primary'} icon={<Flower2 size={17} />} loading={sending} disabled={sentToday} onClick={() => void sendFlower()}>{sentToday ? '今天已送花' : '送一朵花'}</Button>
      </div>
      {data.error && <p className="mt-3 text-xs text-[var(--muted)]">当前展示上次成功加载的搭子信息，网络恢复后会自动更新。</p>}
    </section>
  )
}

function Header() {
  return <h2 id="companion-title" className="flex items-center gap-2 text-sm font-bold text-[var(--accent-strong)]"><HeartHandshake size={18} />一起绽放</h2>
}

function CompanionSkeleton() {
  return <section className="surface companion-card mt-3 rounded-2xl p-4 motion-safe:animate-pulse sm:p-5" aria-label="正在加载搭子信息"><div className="h-5 w-24 rounded bg-[var(--surface-soft)]" /><div className="mt-4 h-4 w-3/4 rounded bg-[var(--surface-soft)]" /><div className="mt-4 grid grid-cols-7 gap-1.5">{Array.from({ length: 7 }, (_, index) => <span key={index} className="h-9 rounded-lg bg-[var(--surface-soft)]" />)}</div></section>
}
