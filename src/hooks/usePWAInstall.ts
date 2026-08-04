import { useCallback, useEffect, useState } from 'react'

const DISMISSED_KEY = 'studybloom:pwa-install-dismissed-at'
const DISMISS_COOLDOWN = 7 * 24 * 60 * 60 * 1000

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isEmbeddedBrowser() {
  return /MicroMessenger|WeChat|QQ\/|Weibo/i.test(navigator.userAgent)
}

function wasRecentlyDismissed() {
  try {
    const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY))
    return Number.isFinite(dismissedAt) && dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_COOLDOWN
  } catch {
    return false
  }
}

function rememberDismissed() {
  try { localStorage.setItem(DISMISSED_KEY, String(Date.now())) } catch { /* 浏览器禁用本地存储时仍允许继续使用应用 */ }
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [ios, setIos] = useState(false)
  const [embedded, setEmbedded] = useState(false)

  useEffect(() => {
    const shouldOffer = !isStandalone() && !wasRecentlyDismissed()
    const currentIOS = isIOS()
    const currentEmbedded = isEmbeddedBrowser()
    setIos(currentIOS)
    setEmbedded(currentEmbedded)

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
      if (shouldOffer) setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    const timer = shouldOffer && (currentIOS || currentEmbedded) ? window.setTimeout(() => setVisible(true), 1200) : undefined
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      if (timer) window.clearTimeout(timer)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (choice.outcome === 'accepted') setVisible(false)
  }, [deferredPrompt])

  const dismiss = useCallback(() => {
    rememberDismissed()
    setVisible(false)
  }, [])

  return {
    visible,
    isIOS: ios,
    isEmbedded: embedded,
    canPrompt: Boolean(deferredPrompt),
    install,
    dismiss,
  }
}
