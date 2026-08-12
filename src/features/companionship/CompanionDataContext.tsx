import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import * as companionService from '../../services/companion'
import type {
  CompanionExperienceMode,
  CompanionHomeState,
  CompanionPreferences,
  CompanionSetting,
  CompanionShareLevel,
  CompanionWeeklySummary,
} from '../../types'
import { getErrorMessage } from '../../utils/errorMessage'

const CACHE_TTL_MS = 3 * 60 * 1000

type CacheState<T> = {
  data: T
  loading: boolean
  refreshing: boolean
  attempted: boolean
  error: string
  loadedAt: number
}

type SettingsBundle = { preferences: CompanionPreferences; settings: CompanionSetting[] }
type WeeklyBundle = { companionId: string; summary: CompanionWeeklySummary | null }

const emptyHome = (): CacheState<CompanionHomeState | null> => ({ data: null, loading: false, refreshing: false, attempted: false, error: '', loadedAt: 0 })
const emptySettings = (): CacheState<SettingsBundle | null> => ({ data: null, loading: false, refreshing: false, attempted: false, error: '', loadedAt: 0 })
const emptyWeekly = (): CacheState<WeeklyBundle | null> => ({ data: null, loading: false, refreshing: false, attempted: false, error: '', loadedAt: 0 })

type CompanionDataContextValue = {
  home: CacheState<CompanionHomeState | null>
  settings: CacheState<SettingsBundle | null>
  weekly: CacheState<WeeklyBundle | null>
  loadHome: (force?: boolean) => Promise<CompanionHomeState | undefined>
  loadSettings: (force?: boolean) => Promise<SettingsBundle | undefined>
  loadWeekly: (companionId: string, force?: boolean) => Promise<CompanionWeeklySummary | null | undefined>
  savePreferences: (update: { primaryCompanionId?: string | null; experienceMode?: CompanionExperienceMode }) => Promise<CompanionPreferences>
  setShare: (companionId: string, shareLevel: CompanionShareLevel) => Promise<CompanionSetting>
  sendFlower: (recipientId: string) => Promise<void>
  invalidateAll: () => void
}

const CompanionDataContext = createContext<CompanionDataContextValue | null>(null)

export function CompanionDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const activeUser = useRef(userId)
  const homeRequest = useRef<Promise<CompanionHomeState | undefined> | null>(null)
  const settingsRequest = useRef<Promise<SettingsBundle | undefined> | null>(null)
  const weeklyRequest = useRef<{ companionId: string; promise: Promise<CompanionWeeklySummary | null | undefined> } | null>(null)
  const [home, setHome] = useState(emptyHome)
  const [settings, setSettings] = useState(emptySettings)
  const [weekly, setWeekly] = useState(emptyWeekly)

  useEffect(() => {
    if (activeUser.current === userId) return
    activeUser.current = userId
    homeRequest.current = null
    settingsRequest.current = null
    weeklyRequest.current = null
    setHome(emptyHome())
    setSettings(emptySettings())
    setWeekly(emptyWeekly())
  }, [userId])

  const loadHome = useCallback((force = false) => {
    if (!userId) return Promise.resolve(undefined)
    if (!force && home.data && Date.now() - home.loadedAt < CACHE_TTL_MS) return Promise.resolve(home.data)
    if (homeRequest.current) return homeRequest.current
    const requestedBy = userId
    setHome((value) => ({ ...value, loading: !value.data, refreshing: Boolean(value.data), error: '' }))
    const request = companionService.getCompanionHomeState()
      .then((data) => {
        if (activeUser.current === requestedBy) setHome({ data, loading: false, refreshing: false, attempted: true, error: '', loadedAt: Date.now() })
        return data
      })
      .catch((error) => {
        if (activeUser.current === requestedBy) setHome((value) => ({ ...value, loading: false, refreshing: false, attempted: true, error: getErrorMessage(error, '搭子信息加载失败') }))
        return undefined
      })
      .finally(() => { if (homeRequest.current === request) homeRequest.current = null })
    homeRequest.current = request
    return request
  }, [home.data, home.loadedAt, userId])

  const loadSettings = useCallback((force = false) => {
    if (!userId) return Promise.resolve(undefined)
    if (!force && settings.data && Date.now() - settings.loadedAt < CACHE_TTL_MS) return Promise.resolve(settings.data)
    if (settingsRequest.current) return settingsRequest.current
    const requestedBy = userId
    setSettings((value) => ({ ...value, loading: !value.data, refreshing: Boolean(value.data), error: '' }))
    const request = Promise.all([companionService.getCompanionPreferences(), companionService.listCompanionSettings()])
      .then(([preferences, list]) => {
        const data = { preferences, settings: list }
        if (activeUser.current === requestedBy) setSettings({ data, loading: false, refreshing: false, attempted: true, error: '', loadedAt: Date.now() })
        return data
      })
      .catch((error) => {
        if (activeUser.current === requestedBy) setSettings((value) => ({ ...value, loading: false, refreshing: false, attempted: true, error: getErrorMessage(error, '搭子设置加载失败') }))
        return undefined
      })
      .finally(() => { if (settingsRequest.current === request) settingsRequest.current = null })
    settingsRequest.current = request
    return request
  }, [settings.data, settings.loadedAt, userId])

  const loadWeekly = useCallback((companionId: string, force = false) => {
    if (!userId || !companionId) return Promise.resolve(undefined)
    if (!force && weekly.data?.companionId === companionId && Date.now() - weekly.loadedAt < CACHE_TTL_MS) return Promise.resolve(weekly.data.summary)
    if (weeklyRequest.current?.companionId === companionId) return weeklyRequest.current.promise
    const requestedBy = userId
    setWeekly((value) => ({ ...value, loading: !value.data || value.data.companionId !== companionId, refreshing: value.data?.companionId === companionId, error: '' }))
    const request = companionService.getCompanionWeeklySummary(companionId)
      .then((summary) => {
        if (activeUser.current === requestedBy && weeklyRequest.current?.promise === request) setWeekly({ data: { companionId, summary }, loading: false, refreshing: false, attempted: true, error: '', loadedAt: Date.now() })
        return summary
      })
      .catch((error) => {
        if (activeUser.current === requestedBy && weeklyRequest.current?.promise === request) setWeekly((value) => ({ ...value, loading: false, refreshing: false, attempted: true, error: getErrorMessage(error, '双人周记加载失败') }))
        return undefined
      })
      .finally(() => { if (weeklyRequest.current?.promise === request) weeklyRequest.current = null })
    weeklyRequest.current = { companionId, promise: request }
    return request
  }, [userId, weekly.data, weekly.loadedAt])

  const savePreferences = useCallback(async (update: { primaryCompanionId?: string | null; experienceMode?: CompanionExperienceMode }) => {
    const next = await companionService.saveCompanionPreferences(update)
    setSettings((value) => value.data ? { ...value, data: { ...value.data, preferences: next }, error: '', loadedAt: Date.now() } : value)
    if (update.primaryCompanionId !== undefined) {
      setHome(emptyHome())
      setWeekly(emptyWeekly())
    } else if (update.experienceMode !== undefined) {
      setHome((value) => value.data ? { ...value, data: { ...value.data, experienceMode: update.experienceMode! }, loadedAt: Date.now() } : value)
    }
    return next
  }, [])

  const setShare = useCallback(async (companionId: string, shareLevel: CompanionShareLevel) => {
    const next = await companionService.setCompanionShareLevel(companionId, shareLevel)
    setSettings((value) => {
      if (!value.data) return value
      const list = value.data.settings.filter((item) => !(item.ownerId === next.ownerId && item.companionId === next.companionId))
      return { ...value, data: { ...value.data, settings: [...list, next] }, error: '', loadedAt: Date.now() }
    })
    setHome(emptyHome())
    setWeekly(emptyWeekly())
    return next
  }, [])

  const sendFlower = useCallback(async (recipientId: string) => {
    await companionService.sendCompanionFlower(recipientId)
    setHome((value) => value.data?.primaryCompanionId === recipientId ? { ...value, data: { ...value.data, sentToday: true }, error: '', loadedAt: Date.now() } : value)
  }, [])

  const invalidateAll = useCallback(() => {
    setHome(emptyHome())
    setSettings(emptySettings())
    setWeekly(emptyWeekly())
  }, [])

  const value = useMemo<CompanionDataContextValue>(() => ({
    home,
    settings,
    weekly,
    loadHome,
    loadSettings,
    loadWeekly,
    savePreferences,
    setShare,
    sendFlower,
    invalidateAll,
  }), [home, settings, weekly, loadHome, loadSettings, loadWeekly, savePreferences, setShare, sendFlower, invalidateAll])

  return <CompanionDataContext.Provider value={value}>{children}</CompanionDataContext.Provider>
}

export function useCompanionData() {
  const value = useContext(CompanionDataContext)
  if (!value) throw new Error('搭子数据必须在 CompanionDataProvider 内使用')
  return value
}
