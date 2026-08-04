import { CloudOff, Cloud } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type NetworkState = 'online' | 'offline' | 'recovered'

export function OfflineBanner() {
  const [state, setState] = useState<NetworkState>(() => navigator.onLine === false ? 'offline' : 'online')
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const onOffline = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      setState('offline')
    }
    const onOnline = () => {
      setState('recovered')
      timerRef.current = window.setTimeout(() => setState('online'), 3600)
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  if (state === 'online') return null
  const offline = state === 'offline'
  return (
    <div className={`pwa-top-banner fixed inset-x-4 z-[60] mx-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${offline ? 'bg-[var(--rose-soft)] text-[var(--rose)]' : 'bg-[var(--accent-soft)] text-[var(--accent-strong)]'}`} role="status" aria-live="polite">
      {offline ? <CloudOff size={18} className="shrink-0" /> : <Cloud size={18} className="shrink-0" />}
      <span>{offline ? '当前处于离线状态，云端数据暂时不可用。' : '网络已恢复，可以继续同步计划。'}</span>
    </div>
  )
}
