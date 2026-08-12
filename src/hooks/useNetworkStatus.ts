import { useEffect, useState } from 'react'

/** Shared browser network state for banners and mutation guards. */
export function useNetworkStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine !== false)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}
