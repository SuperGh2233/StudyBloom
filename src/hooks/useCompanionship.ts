import { subDays } from 'date-fns'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { useFriendships } from './useFriendships'
import type {
  CompanionDaySummary,
  CompanionEncouragement,
  CompanionExperienceMode,
  CompanionPreferences,
  CompanionSetting,
  CompanionShareLevel,
  CompanionWeeklySummary,
} from '../types'
import * as companionService from '../services/companion'
import { fetchStudyDataForRange } from '../services/studySessions'
import { formatDateKey, todayDateKey } from '../utils/date'
import { getErrorMessage } from '../utils/errorMessage'
import { calculateStudyStatistics } from '../utils/studyDuration'

type FriendData = ReturnType<typeof useFriendships>

export function useCompanionship(friends: FriendData) {
  const [preferences, setPreferences] = useState<CompanionPreferences | null>(null)
  const [settings, setSettings] = useState<CompanionSetting[]>([])
  const [companionDays, setCompanionDays] = useState<CompanionDaySummary[]>([])
  const [ownDays, setOwnDays] = useState<CompanionDaySummary[]>([])
  const [encouragements, setEncouragements] = useState<CompanionEncouragement[]>([])
  const [weekly, setWeekly] = useState<CompanionWeeklySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const friendIds = useMemo(() => friends.friends.map(friends.counterpartId), [friends.friends, friends.counterpartId])
  const friendKey = friendIds.join('|')

  const load = useCallback(async () => {
    if (friends.loading || !friends.me) return
    setLoading(true); setError('')
    try {
      const [nextPreferences, nextSettings] = await Promise.all([
        companionService.getCompanionPreferences(),
        companionService.listCompanionSettings(),
      ])
      const primaryId = nextPreferences.primaryCompanionId && friendIds.includes(nextPreferences.primaryCompanionId) ? nextPreferences.primaryCompanionId : null
      const safePreferences = primaryId === nextPreferences.primaryCompanionId ? nextPreferences : { ...nextPreferences, primaryCompanionId: null }
      setPreferences(safePreferences); setSettings(nextSettings)
      if (!primaryId) { setCompanionDays([]); setOwnDays([]); setEncouragements([]); setWeekly(null); return }

      const endDate = todayDateKey()
      const startDate = formatDateKey(subDays(new Date(), 6))
      const theirLevel = nextSettings.find((item) => item.ownerId === primaryId && item.companionId === friends.me)?.shareLevel ?? 'none'
      const myLevel = nextSettings.find((item) => item.ownerId === friends.me && item.companionId === primaryId)?.shareLevel ?? 'none'
      const [{ sessions, segments }, flowers, remoteDays, weeklySummary] = await Promise.all([
        fetchStudyDataForRange(startDate, endDate),
        companionService.listCompanionEncouragements(startDate, endDate),
        theirLevel === 'none' ? Promise.resolve([]) : companionService.getCompanionSummary(primaryId, startDate, endDate),
        myLevel === 'none' || theirLevel === 'none' ? Promise.resolve(null) : companionService.getCompanionWeeklySummary(primaryId),
      ])
      const metrics = calculateStudyStatistics(sessions, segments, { startDate, endDate })
      setOwnDays(metrics.byDay.map((day) => ({ date: day.date, effectiveStudy: day.seconds >= 600, studiedMinutes: Math.floor(day.seconds / 60), completedTasks: null, totalTasks: null })))
      setCompanionDays(remoteDays); setEncouragements(flowers.filter((item) => item.senderId === primaryId || item.recipientId === primaryId)); setWeekly(weeklySummary)
    } catch (reason) { setError(getErrorMessage(reason, '搭子信息加载失败')) }
    finally { setLoading(false) }
  // friendKey intentionally represents accepted relationship changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendKey, friends.loading, friends.me])

  useEffect(() => { void load() }, [load])

  const primaryId = preferences?.primaryCompanionId ?? null
  const primaryProfile = primaryId ? friends.profiles.get(primaryId) ?? null : null
  const primaryName = primaryId ? friends.notes.get(primaryId)?.remark ?? primaryProfile?.displayName ?? '学习搭子' : ''
  const ownShareLevel = primaryId ? settings.find((item) => item.ownerId === friends.me && item.companionId === primaryId)?.shareLevel ?? 'none' : 'none'
  const companionShareLevel = primaryId ? settings.find((item) => item.ownerId === primaryId && item.companionId === friends.me)?.shareLevel ?? 'none' : 'none'

  const setPrimary = useCallback(async (companionId: string | null) => { await companionService.saveCompanionPreferences({ primaryCompanionId: companionId }); await load() }, [load])
  const setMode = useCallback(async (experienceMode: CompanionExperienceMode) => { await companionService.saveCompanionPreferences({ experienceMode }); await load() }, [load])
  const setShare = useCallback(async (companionId: string, shareLevel: CompanionShareLevel) => { await companionService.setCompanionShareLevel(companionId, shareLevel); await load() }, [load])
  const sendFlower = useCallback(async () => { if (!primaryId) return; await companionService.sendCompanionFlower(primaryId); await load() }, [load, primaryId])

  return {
    loading,
    error,
    preferences,
    settings,
    friendIds,
    primaryId,
    primaryProfile,
    primaryName,
    ownShareLevel,
    companionShareLevel,
    ownDays,
    companionDays,
    encouragements,
    weekly,
    reload: load,
    setPrimary,
    setMode,
    setShare,
    sendFlower,
  }
}

