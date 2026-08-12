import { useCallback, useEffect } from 'react'
import { useCompanionData } from '../features/companionship/CompanionDataContext'

export function useCompanionHome() {
  const { home, loadHome, sendFlower: sendFlowerTo } = useCompanionData()
  useEffect(() => { void loadHome() }, [loadHome])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void loadHome(true) }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('online', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('online', refresh)
    }
  }, [loadHome])

  const reload = useCallback(() => loadHome(true), [loadHome])
  const sendFlower = useCallback(async () => {
    const companionId = home.data?.primaryCompanionId
    if (companionId) await sendFlowerTo(companionId)
  }, [home.data?.primaryCompanionId, sendFlowerTo])

  return {
    ...home,
    reload,
    sendFlower,
  }
}
