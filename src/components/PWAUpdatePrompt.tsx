import { Check, Download, RefreshCw, X } from 'lucide-react'
import { useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function PWAUpdatePrompt() {
  const [updateError, setUpdateError] = useState(false)
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () => setUpdateError(true),
  })

  const applyUpdate = async () => {
    try {
      await updateServiceWorker(true)
    } catch {
      setNeedRefresh(false)
      setUpdateError(true)
    }
  }

  if (!offlineReady && !needRefresh && !updateError) return null
  if (updateError) {
    return <div className="pwa-update-banner fixed inset-x-4 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-xl bg-[var(--rose-soft)] px-4 py-3 text-sm font-medium text-[var(--rose)]" role="alert"><span className="flex-1">应用更新失败，请稍后重试。</span><button type="button" className="focus-ring grid h-9 w-9 place-items-center rounded-lg" onClick={() => setUpdateError(false)} aria-label="关闭提示"><X size={17} /></button></div>
  }
  if (needRefresh) {
    return <div className="pwa-update-banner surface fixed inset-x-4 z-[60] mx-auto flex max-w-md items-center gap-3 rounded-xl px-4 py-3 text-sm" role="status"><RefreshCw className="shrink-0 text-[var(--accent-strong)]" size={18} /><span className="flex-1 font-medium">StudyBloom 有新版本可用。</span><button type="button" className="focus-ring min-h-10 rounded-lg px-2 font-semibold text-[var(--muted)]" onClick={() => setNeedRefresh(false)}>稍后</button><button type="button" className="focus-ring inline-flex min-h-10 items-center gap-1 rounded-lg bg-[var(--accent-strong)] px-3 font-semibold text-white" onClick={() => void applyUpdate()}><Download size={15} />立即更新</button></div>
  }
  return <div className="pwa-update-banner fixed inset-x-4 z-[60] mx-auto flex max-w-md items-center gap-2 rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-sm font-medium text-[var(--accent-strong)]" role="status"><Check size={18} className="shrink-0" /><span className="flex-1">StudyBloom 已准备好离线打开。</span><button type="button" className="focus-ring grid h-9 w-9 place-items-center rounded-lg" onClick={() => setOfflineReady(false)} aria-label="关闭提示"><X size={17} /></button></div>
}
