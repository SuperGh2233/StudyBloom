import { format } from 'date-fns'
import { LogIn, LogOut, MapPin, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { LoadingState } from '../../components/LoadingState'
import { useToast } from '../../components/ToastProvider'
import type { AttendanceRecord, GeoPoint, StudyLocation } from '../../types'
import { getErrorMessage } from '../../utils/errorMessage'
import { assertAccuracy, distanceToLocationM, formatDistanceM, getCurrentPosition } from '../../utils/geolocation'
import { formatDurationHuman } from '../../utils/studyDuration'

interface AttendanceCardProps {
  locations: StudyLocation[]
  openRecord: AttendanceRecord | null
  loading: boolean
  error: string
  nowMs: number
  online: boolean
  onReload: () => void
  onCheckIn: (locationId: string, point: GeoPoint) => Promise<AttendanceRecord>
  onCheckOut: (point: GeoPoint) => Promise<AttendanceRecord>
  onForceClose: () => Promise<void>
  /** Notify the page to refresh today's records after a mutation. */
  onChanged: () => void
}

export function AttendanceCard({ locations, openRecord, loading, error, nowMs, online, onReload, onCheckIn, onCheckOut, onForceClose, onChanged }: AttendanceCardProps) {
  const { showToast } = useToast()
  const [locationId, setLocationId] = useState('')
  const [busy, setBusy] = useState('')
  const [distanceError, setDistanceError] = useState('')
  const [forceCloseOpen, setForceCloseOpen] = useState(false)
  const acting = busy !== '' || !online

  const activeLocations = locations.filter((location) => location.isActive)

  useEffect(() => {
    const actives = locations.filter((location) => location.isActive)
    if (!actives.length) return
    if (actives.some((location) => location.id === locationId)) return
    setLocationId((actives.find((location) => location.isDefault) ?? actives[0]).id)
  }, [locations, locationId])

  const selected = activeLocations.find((location) => location.id === locationId) ?? null

  const handleCheckIn = async () => {
    if (acting || !selected) return
    setBusy('check-in')
    setDistanceError('')
    try {
      const point = await getCurrentPosition()
      assertAccuracy(point)
      const distanceM = distanceToLocationM(point, selected)
      if (distanceM > selected.radiusM) {
        setDistanceError(`你距离「${selected.name}」约 ${formatDistanceM(distanceM)}，允许签到范围为 ${selected.radiusM} 米。`)
        return
      }
      await onCheckIn(selected.id, point)
      showToast('签到成功，安心开始学习')
      onChanged()
    } catch (reason) {
      showToast(getErrorMessage(reason, '签到失败'), 'error')
    } finally {
      setBusy('')
    }
  }

  const handleCheckOut = async () => {
    if (acting) return
    setBusy('check-out')
    try {
      const point = await getCurrentPosition()
      await onCheckOut(point)
      showToast('已签退，辛苦啦')
      onChanged()
    } catch (reason) {
      showToast(getErrorMessage(reason, '签退失败'), 'error')
    } finally {
      setBusy('')
    }
  }

  const handleForceClose = async () => {
    if (acting) return
    setBusy('force-close')
    try {
      await onForceClose()
      setForceCloseOpen(false)
      showToast('本次记录已异常结束')
      onChanged()
    } catch (reason) {
      showToast(getErrorMessage(reason, '结束记录失败'), 'error')
    } finally {
      setBusy('')
    }
  }

  const openLocation = openRecord ? locations.find((location) => location.id === openRecord.locationId) : undefined

  return (
    <section className="surface rounded-2xl p-5" aria-label="地点签到">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><MapPin size={21} strokeWidth={1.8} /></span>
        <div className="min-w-0">
          <h2 className="font-bold">地点签到</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">到达学习地点后签到，离开时签退。</p>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--rose-soft)] px-3.5 py-3 text-xs text-[var(--rose)]">
          <span className="min-w-0">{error}</span>
          <Button variant="secondary" className="shrink-0" icon={<RefreshCw size={15} />} onClick={onReload} aria-label="重新加载地点签到信息">重试</Button>
        </div>
      )}

      {loading && !activeLocations.length && !openRecord && !error ? (
        <LoadingState label="正在读取学习地点..." />
      ) : openRecord ? (
        <div className="gentle-enter mt-5">
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-lg font-bold">{openLocation?.name ?? '学习地点'}</p>
            <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)]">已签到</span>
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">签到于 {format(new Date(openRecord.checkInAt), 'HH:mm')} · 在场 {formatDurationHuman(Math.max(0, Math.floor((nowMs - Date.parse(openRecord.checkInAt)) / 1000)))}</p>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            定位精度约 {Math.round(openRecord.checkInAccuracyM)} 米 · 距地点 {formatDistanceM(openRecord.checkInDistanceM)}{openLocation ? ` · 签到范围 ${openLocation.radiusM} 米` : ''}
          </p>
          <Button className="mt-4 w-full" icon={<LogOut size={18} />} loading={busy === 'check-out'} disabled={acting} onClick={() => void handleCheckOut()} aria-label="签退">签退</Button>
          <button
            type="button"
            className="focus-ring mx-auto mt-2 flex min-h-11 items-center rounded-xl px-3 text-xs text-[var(--muted)] transition hover:text-[var(--rose)]"
            disabled={acting}
            onClick={() => setForceCloseOpen(true)}
            aria-label="异常结束本次签到记录"
          >异常结束本次记录</button>
        </div>
      ) : !activeLocations.length ? (
        <p className="mt-5 rounded-xl bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--muted)]">还没有可用的学习地点，请先在设置中添加地点。</p>
      ) : (
        <div className="mt-5">
          <label className="grid gap-2 text-sm font-medium text-[var(--ink)]" htmlFor="study-location">
            学习地点
            <select
              id="study-location"
              className="focus-ring min-h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 text-base text-[var(--ink)]"
              value={locationId}
              disabled={acting}
              onChange={(event) => { setLocationId(event.target.value); setDistanceError('') }}
            >
              {activeLocations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}（范围 {location.radiusM} 米）</option>
              ))}
            </select>
          </label>
          <Button className="mt-4 w-full" icon={<LogIn size={18} />} loading={busy === 'check-in'} disabled={acting || !selected} onClick={() => void handleCheckIn()} aria-label="使用当前位置签到">签到</Button>
          {distanceError && <p className="mt-3 rounded-xl bg-[var(--rose-soft)] px-3.5 py-2.5 text-xs leading-5 text-[var(--rose)]" role="alert">{distanceError}</p>}
        </div>
      )}

      <ConfirmDialog
        open={forceCloseOpen}
        title="异常结束本次记录？"
        description="异常结束不计入有效在场时长，仅在忘记签退时使用。"
        confirmLabel="异常结束"
        danger
        loading={busy === 'force-close'}
        onClose={() => setForceCloseOpen(false)}
        onConfirm={() => void handleForceClose()}
      />
    </section>
  )
}
