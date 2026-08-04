import { Download, ExternalLink, Share2, Smartphone, X } from 'lucide-react'
import { Button } from './Button'
import { usePWAInstall } from '../hooks/usePWAInstall'

export function InstallPWA() {
  const { visible, isIOS, isEmbedded, canPrompt, install, dismiss } = usePWAInstall()
  if (!visible) return null

  return (
    <aside className="pwa-install-card surface gentle-enter fixed inset-x-4 z-40 mx-auto w-auto max-w-md rounded-2xl p-4" aria-label="安装 StudyBloom">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-strong)] text-white"><Smartphone size={20} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-bold">把 StudyBloom 放到主屏幕</h2>
            <button type="button" className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--muted)]" onClick={dismiss} aria-label="稍后提醒"><X size={18} /></button>
          </div>
          {isEmbedded ? (
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]"><ExternalLink className="mr-1 inline-block align-text-bottom" size={15} />请点击浏览器菜单，选择“在 Safari 中打开”后再添加到主屏幕。</p>
          ) : isIOS ? (
            <ol className="mt-2 grid gap-1 text-sm leading-6 text-[var(--muted)]">
              <li><Share2 className="mr-1 inline-block align-text-bottom" size={15} />点击 Safari 底部的分享按钮。</li>
              <li>选择“添加到主屏幕”，再点击右上角“添加”。</li>
            </ol>
          ) : (
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">安装后可以像独立 App 一样打开，加载更顺手。</p>
          )}
          <div className="mt-3 flex items-center justify-end gap-2">
            {canPrompt && <Button type="button" className="px-3" icon={<Download size={16} />} onClick={() => void install()}>立即安装</Button>}
            <button type="button" className="focus-ring min-h-11 rounded-xl px-3 text-sm font-semibold text-[var(--muted)]" onClick={dismiss}>稍后</button>
          </div>
        </div>
      </div>
    </aside>
  )
}
