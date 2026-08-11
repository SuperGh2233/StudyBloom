import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { LocateFixed } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Input } from '../../components/FormField'
import { useToast } from '../../components/ToastProvider'
import { useAttendance } from '../../hooks/useAttendance'
import { clampRadiusM, createStudyLocation, setDefaultStudyLocation, updateStudyLocation } from '../../services/attendance'
import { LOCATION_LIMITS, type StudyLocation } from '../../types'
import { getErrorMessage } from '../../utils/errorMessage'
import { assertAccuracy, getCurrentPosition } from '../../utils/geolocation'

export function StudyLocationSettings() {
  const { locations, loading, error, reload } = useAttendance()
  const { showToast } = useToast()
  const [busy, setBusy] = useState('')
  const [newName, setNewName] = useState('')
  const [newRadius, setNewRadius] = useState(String(LOCATION_LIMITS.radiusDefaultM))
  const [deactivating, setDeactivating] = useState<StudyLocation | null>(null)
  const [repositioning, setRepositioning] = useState<StudyLocation | null>(null)

  const run = (key: string, action: () => Promise<unknown>, success: string) => {
    if (busy) return
    setBusy(key)
    void action()
      .then(() => reload(true))
      .then(() => showToast(success))
      .catch((reason) => { showToast(getErrorMessage(reason, '操作失败'), 'error') })
      .finally(() => { setBusy('') })
  }

  const addLocation = (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const name = newName.trim()
    if (!name) return showToast('地点名称不能为空', 'error')
    run('add', async () => {
      const point = await getCurrentPosition()
      assertAccuracy(point)
      await createStudyLocation({ name, latitude: point.latitude, longitude: point.longitude, radiusM: clampRadiusM(Number(newRadius)) })
      setNewName('')
      setNewRadius(String(LOCATION_LIMITS.radiusDefaultM))
    }, '地点已添加')
  }

  // 改中心是破坏性操作（旧坐标无提示被覆盖会导致无法签到），先二次确认。
  const updatePosition = (location: StudyLocation) => setRepositioning(location)

  const toggleActive = (location: StudyLocation) => {
    if (location.isActive) return setDeactivating(location)
    run(`toggle:${location.id}`, () => updateStudyLocation(location.id, { isActive: true }), '地点已启用')
  }

  const sorted = [...locations].sort((a, b) => Number(b.isActive) - Number(a.isActive))

  return (
    <div className="mt-5 grid gap-4">
      <form className="grid gap-3 rounded-xl bg-[var(--surface-soft)] p-4" onSubmit={addLocation}>
        <p className="text-sm font-bold">添加学习地点</p>
        <Input label="地点名称" name="new-location-name" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="例如：学校图书馆" maxLength={50} disabled={Boolean(busy)} />
        <Input label="签到半径（米）" name="new-location-radius" type="number" inputMode="numeric" min={LOCATION_LIMITS.radiusMinM} max={LOCATION_LIMITS.radiusMaxM} step={50} value={newRadius} onChange={(event) => setNewRadius(event.target.value)} disabled={Boolean(busy)} />
        <Button type="submit" disabled={Boolean(busy)} loading={busy === 'add'} icon={<LocateFixed size={18} />}>使用当前位置并保存</Button>
        <p className="text-xs leading-5 text-[var(--muted)]">到达地点后再添加；第一版不需要地图，中心坐标由当前位置确定。</p>
      </form>

      {loading && locations.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">正在加载学习地点…</p>
      ) : sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-sm text-[var(--muted)]">{error || '还没有学习地点，先在上方添加一个吧。'}</p>
      ) : (
        <div className="grid gap-3">
          {error && <p className="text-sm text-[#b84d56]">{error}</p>}
          {sorted.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              busy={busy}
              onRename={(id, name) => run(`name:${id}`, () => updateStudyLocation(id, { name }), '地点名称已保存')}
              onRadius={(id, radiusM) => run(`radius:${id}`, () => updateStudyLocation(id, { radiusM }), '签到半径已更新')}
              onSetDefault={(id) => run(`default:${id}`, () => setDefaultStudyLocation(id), '已设为默认地点')}
              onUpdatePosition={updatePosition}
              onToggleActive={toggleActive}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deactivating)}
        title={`停用「${deactivating?.name ?? ''}」？`}
        description="停用后不能在此地点签到；历史签到记录会保留。"
        confirmLabel="停用"
        danger
        loading={busy === 'deactivate'}
        onClose={() => { if (busy !== 'deactivate') setDeactivating(null) }}
        onConfirm={() => {
          if (!deactivating) return
          const target = deactivating
          run('deactivate', async () => { await updateStudyLocation(target.id, { isActive: false }); setDeactivating(null) }, '地点已停用')
        }}
      />

      <ConfirmDialog
        open={Boolean(repositioning)}
        title={`将「${repositioning?.name ?? ''}」的中心更新为当前位置？`}
        description="原中心坐标将被覆盖，签到范围将以新坐标判定；历史签到记录不受影响。请确认你人就在该地点。"
        confirmLabel="更新中心"
        loading={busy === `gps:${repositioning?.id ?? ''}`}
        onClose={() => { if (!busy.startsWith('gps:')) setRepositioning(null) }}
        onConfirm={() => {
          if (!repositioning) return
          const target = repositioning
          run(`gps:${target.id}`, async () => {
            const point = await getCurrentPosition()
            assertAccuracy(point)
            await updateStudyLocation(target.id, { latitude: point.latitude, longitude: point.longitude })
            setRepositioning(null)
          }, '位置已更新')
        }}
      />
    </div>
  )
}

interface LocationCardProps {
  location: StudyLocation
  busy: string
  onRename: (id: string, name: string) => void
  onRadius: (id: string, radiusM: number) => void
  onSetDefault: (id: string) => void
  onUpdatePosition: (location: StudyLocation) => void
  onToggleActive: (location: StudyLocation) => void
}

function LocationCard({ location, busy, onRename, onRadius, onSetDefault, onUpdatePosition, onToggleActive }: LocationCardProps) {
  const { showToast } = useToast()
  const [draftName, setDraftName] = useState(location.name)
  const [draftRadius, setDraftRadius] = useState(String(location.radiusM))
  useEffect(() => { setDraftName(location.name); setDraftRadius(String(location.radiusM)) }, [location.name, location.radiusM])

  const submitName = (event: FormEvent) => {
    event.preventDefault()
    const next = draftName.trim()
    if (!next) {
      setDraftName(location.name)
      showToast('地点名称不能为空', 'error')
      return
    }
    if (next !== location.name) onRename(location.id, next)
  }

  const commitRadius = () => {
    if (busy) return
    const next = clampRadiusM(Number(draftRadius))
    setDraftRadius(String(next))
    if (next !== location.radiusM) onRadius(location.id, next)
  }

  return (
    <article className={`rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 ${location.isActive ? '' : 'opacity-70'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <form className="flex min-w-0 flex-1 basis-52 gap-2" onSubmit={submitName}>
          <input
            aria-label={`编辑地点名称 ${location.name}`}
            className="focus-ring min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-base text-[var(--ink)]"
            value={draftName}
            maxLength={50}
            onChange={(event) => setDraftName(event.target.value)}
            disabled={Boolean(busy)}
          />
          <Button type="submit" className="shrink-0 px-3" disabled={Boolean(busy)} aria-label={`保存地点名称 ${location.name}`}>保存</Button>
        </form>
        {location.isDefault && <span className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)]">默认</span>}
        {!location.isActive && <span className="shrink-0 rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">停用</span>}
      </div>

      <label className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]">签到半径
        <input
          type="number"
          inputMode="numeric"
          min={LOCATION_LIMITS.radiusMinM}
          max={LOCATION_LIMITS.radiusMaxM}
          step={50}
          aria-label={`${location.name} 的签到半径（米）`}
          className="focus-ring min-h-11 w-24 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-base text-[var(--ink)]"
          value={draftRadius}
          onChange={(event) => setDraftRadius(event.target.value)}
          onBlur={commitRadius}
          disabled={Boolean(busy)}
        />
        米
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        {!location.isDefault && location.isActive && (
          <Button variant="secondary" className="px-3" disabled={Boolean(busy)} loading={busy === `default:${location.id}`} onClick={() => onSetDefault(location.id)} aria-label={`将 ${location.name} 设为默认地点`}>设为默认</Button>
        )}
        <Button variant="secondary" className="px-3" disabled={Boolean(busy)} loading={busy === `gps:${location.id}`} onClick={() => onUpdatePosition(location)} aria-label={`更新 ${location.name} 的位置`}>更新位置</Button>
        <Button variant="ghost" className={`px-3 ${location.isActive ? 'text-[var(--rose)]' : ''}`} disabled={Boolean(busy)} loading={busy === `toggle:${location.id}`} onClick={() => onToggleActive(location)} aria-label={location.isActive ? `停用地点 ${location.name}` : `启用地点 ${location.name}`}>{location.isActive ? '停用' : '启用'}</Button>
      </div>

      <details className="mt-3 rounded-xl bg-[var(--surface-soft)] px-3">
        <summary className="focus-ring flex min-h-11 cursor-pointer select-none items-center text-sm font-medium text-[var(--muted)]">高级信息</summary>
        <div className="grid gap-1 pb-3 text-xs text-[var(--muted)]">
          <p>纬度：{location.latitude.toFixed(5)}</p>
          <p>经度：{location.longitude.toFixed(5)}</p>
          <p>签到半径：{location.radiusM} 米</p>
          <p>添加时间：{format(parseISO(location.createdAt), 'yyyy年M月d日 HH:mm', { locale: zhCN })}</p>
        </div>
      </details>
    </article>
  )
}
