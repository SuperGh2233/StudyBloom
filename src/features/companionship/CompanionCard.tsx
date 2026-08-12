import { Flower2, HeartHandshake, RefreshCw, Settings2, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { useToast } from '../../components/ToastProvider'
import type { useCompanionship } from '../../hooks/useCompanionship'
import type { useFriendships } from '../../hooks/useFriendships'
import { todayDateKey } from '../../utils/date'
import { getErrorMessage } from '../../utils/errorMessage'
import { sharedBloomDatesWithConsent } from './companionUtils'

type CompanionData = ReturnType<typeof useCompanionship>
type FriendData = ReturnType<typeof useFriendships>

export function CompanionCard({ data, friends }: { data: CompanionData; friends: FriendData }) {
  const { showToast } = useToast()
  const today = todayDateKey()
  const bloomDates = sharedBloomDatesWithConsent(data.ownShareLevel, data.companionShareLevel, data.ownDays, data.companionDays)
  const companionToday = data.companionDays.find((day) => day.date === today)
  const sentToday = data.encouragements.some((item) => item.senderId === friends.me && item.sentOn === today)
  const receivedToday = data.encouragements.some((item) => item.recipientId === friends.me && item.sentOn === today)
  const mutualToday = sentToday && receivedToday

  const sendFlower = async () => {
    try { await data.sendFlower(); showToast('小花已经送到') }
    catch (error) { showToast(getErrorMessage(error, '送花失败'), 'error') }
  }

  if (data.loading || friends.loading) return <CompanionSkeleton />

  if (data.error) return (
    <section className="surface companion-card mt-3 rounded-2xl p-4 sm:p-5" aria-labelledby="companion-title">
      <Header />
      <p className="mt-3 text-sm text-[var(--muted)]">{typeof navigator !== 'undefined' && !navigator.onLine ? '当前处于离线状态，恢复网络后可以重新加载搭子动态。' : '暂时没取到搭子动态，不影响你的学习。'}</p>
      <Button variant="secondary" className="mt-3" icon={<RefreshCw size={16} />} onClick={() => data.reload()}>重新加载</Button>
    </section>
  )

  if (!friends.friends.length) return (
    <section className="surface companion-card mt-3 rounded-2xl p-4 sm:p-5" aria-labelledby="companion-title">
      <Header />
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">邀请一位固定搭子。你们不必同时在线，也不会自动共享学习记录。</p>
      <Link className="focus-ring mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white" to="/friends"><UserPlus size={17} />邀请搭子</Link>
    </section>
  )

  if (!data.primaryId) return (
    <section className="surface companion-card mt-3 rounded-2xl p-4 sm:p-5" aria-labelledby="companion-title">
      <Header />
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">选择一位首页搭子。设置搭子不会自动开放任何学习数据。</p>
      <Link className="focus-ring mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] px-4 text-sm font-semibold text-[var(--accent-strong)]" to="/settings#companionship"><Settings2 size={17} />选择首页搭子</Link>
    </section>
  )

  const sharedToday = bloomDates.has(today)
  return (
    <section className={`surface companion-card relative mt-3 overflow-hidden rounded-2xl p-4 sm:p-5 ${sharedToday ? 'companion-bloom' : ''}`} aria-labelledby="companion-title">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0"><Header /><p className="mt-1 truncate text-sm font-semibold">你和 {data.primaryName}</p></div>
        <Link to="/settings#companionship" className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--muted)]" aria-label="管理搭子与分享"><Settings2 size={18} /></Link>
      </div>

      <div className="mt-4 min-w-0">
        {sharedToday ? (
          <p className="text-base font-bold text-[var(--accent-strong)]">你们今天都认真学习过，一起绽放了一天。</p>
        ) : data.companionShareLevel === 'none' ? (
          <><p className="text-sm font-semibold">学习记录由 {data.primaryName} 自己掌握</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">分享由每个人自己决定。你仍然可以送出一朵表示陪伴的小花。</p></>
        ) : companionToday?.effectiveStudy ? (
          <><p className="text-sm font-semibold">{data.primaryName} 今天也为目标留出了一段时间。</p>{data.companionShareLevel === 'summary' && <p className="mt-1 text-xs text-[var(--muted)]">有效学习 {companionToday.studiedMinutes ?? 0} 分钟，完成 {companionToday.completedTasks ?? 0}/{companionToday.totalTasks ?? 0} 项任务</p>}</>
        ) : (
          <p className="text-sm text-[var(--muted)]">今天暂时没有可分享的记录。今天可以慢慢来，也可以安心休息。</p>
        )}
      </div>

      {data.ownShareLevel === 'none' && <p className="mt-3 rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-xs leading-5 text-[var(--muted)]">你尚未向 {data.primaryName} 分享学习状态。开启“仅共同绽放”也不会暴露时长和任务。</p>}

      <div className="mt-4 grid grid-cols-7 gap-1.5" aria-label="最近七天共同绽放记录">
        {data.ownDays.map((day) => {
          const bloomed = bloomDates.has(day.date)
          return <span key={day.date} className={`grid min-h-9 min-w-0 place-items-center rounded-lg ${bloomed ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'bg-[var(--surface-soft)] text-[var(--muted)]'}`} title={`${day.date}${bloomed ? '共同绽放' : '安静记录'}`}><Flower2 size={bloomed ? 18 : 14} strokeWidth={bloomed ? 2 : 1.5} aria-hidden="true" /></span>
        })}
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
        <div className="min-w-0"><p className="text-sm font-semibold">{data.weekly ? `本周一起学习了 ${data.weekly.weekBloomDays} 天` : '每一次认真都值得被看见'}</p>{receivedToday && <p className="mt-0.5 text-xs text-[var(--rose)]">{mutualToday ? '今天你们互相送了一朵花' : `${data.primaryName} 今天送来一朵花`}</p>}</div>
        <Button className="shrink-0" variant={sentToday ? 'secondary' : 'primary'} icon={<Flower2 size={17} />} disabled={sentToday} onClick={() => void sendFlower()}>{sentToday ? '今天已送花' : '送一朵花'}</Button>
      </div>
    </section>
  )
}

function Header() {
  return <h2 id="companion-title" className="flex items-center gap-2 text-sm font-bold text-[var(--accent-strong)]"><HeartHandshake size={18} />一起绽放</h2>
}

function CompanionSkeleton() {
  return <section className="surface companion-card mt-3 rounded-2xl p-4 motion-safe:animate-pulse sm:p-5" aria-label="正在加载搭子信息"><div className="h-5 w-24 rounded bg-[var(--surface-soft)]" /><div className="mt-4 h-4 w-3/4 rounded bg-[var(--surface-soft)]" /><div className="mt-4 grid grid-cols-7 gap-1.5">{Array.from({ length: 7 }, (_, index) => <span key={index} className="h-9 rounded-lg bg-[var(--surface-soft)]" />)}</div></section>
}
