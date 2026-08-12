import { useCallback, useEffect } from 'react'
import { useCompanionData } from '../features/companionship/CompanionDataContext'

export function useCompanionWeekly(companionId: string | null) {
  const { weekly, loadWeekly } = useCompanionData()
  useEffect(() => { if (companionId) void loadWeekly(companionId) }, [companionId, loadWeekly])
  const reload = useCallback(() => companionId ? loadWeekly(companionId, true) : Promise.resolve(undefined), [companionId, loadWeekly])
  const matches = weekly.data?.companionId === companionId
  return {
    loading: Boolean(companionId) && weekly.loading,
    refreshing: matches && weekly.refreshing,
    error: weekly.error,
    summary: matches ? weekly.data?.summary ?? null : null,
    reload,
  }
}
