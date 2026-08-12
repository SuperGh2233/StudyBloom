import { useCallback, useEffect } from 'react'
import { useCompanionData } from '../features/companionship/CompanionDataContext'
import type { CompanionExperienceMode, CompanionShareLevel } from '../types'

export function useCompanionSettings(ownerId = '') {
  const { settings: state, loadSettings, savePreferences, setShare: saveShare } = useCompanionData()
  useEffect(() => { void loadSettings() }, [loadSettings])

  const setPrimary = useCallback((companionId: string | null) => savePreferences({ primaryCompanionId: companionId }), [savePreferences])
  const setMode = useCallback((experienceMode: CompanionExperienceMode) => savePreferences({ experienceMode }), [savePreferences])
  const setup = useCallback((companionId: string, experienceMode: CompanionExperienceMode) => savePreferences({ primaryCompanionId: companionId, experienceMode }), [savePreferences])
  const setShare = useCallback((companionId: string, shareLevel: CompanionShareLevel) => saveShare(companionId, shareLevel), [saveShare])
  const preferences = state.data?.preferences ?? null
  const settings = state.data?.settings ?? []
  const primaryId = preferences?.primaryCompanionId ?? null
  const ownShareLevel = primaryId ? settings.find((item) => item.ownerId === ownerId && item.companionId === primaryId)?.shareLevel ?? 'none' : 'none'

  return {
    ...state,
    loading: state.loading || !state.attempted,
    preferences,
    settings,
    primaryId,
    ownShareLevel,
    reload: () => loadSettings(true),
    setPrimary,
    setMode,
    setup,
    setShare,
  }
}
