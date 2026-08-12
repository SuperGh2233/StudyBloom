import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useCompanionData } from '../companionship/CompanionDataContext'
import * as shareService from '../../services/calendarShares'
import * as friendshipService from '../../services/friendships'
import * as noteService from '../../services/friendNotes'
import * as profileService from '../../services/profiles'
import type { CalendarShare, FriendNote, Friendship, Profile } from '../../types'
import { getErrorMessage } from '../../utils/errorMessage'

type FriendshipsContextValue = {
  loading: boolean
  loaded: boolean
  error: string
  me: string
  myProfile: Profile | null
  friendships: Friendship[]
  shares: CalendarShare[]
  profiles: Map<string, Profile>
  notes: Map<string, FriendNote>
  load: (force?: boolean) => Promise<void>
  send: (addresseeId: string) => Promise<void>
  accept: (id: string) => Promise<void>
  reject: (id: string) => Promise<void>
  cancel: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  block: (id: string) => Promise<void>
  setShare: (viewerId: string, canView: boolean) => Promise<void>
  saveNote: (friendId: string, remark: string) => Promise<void>
  updateProfile: (update: { displayName?: string; allowRequests?: boolean }) => Promise<Profile>
}

const FriendshipsContext = createContext<FriendshipsContextValue | null>(null)

export function FriendshipsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { invalidateAll: invalidateCompanion } = useCompanionData()
  const me = user?.id ?? ''
  const activeUser = useRef(me)
  const requestRef = useRef<Promise<void> | null>(null)
  const [friendships, setFriendships] = useState<Friendship[]>([])
  const [shares, setShares] = useState<CalendarShare[]>([])
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map())
  const [notes, setNotes] = useState<Map<string, FriendNote>>(new Map())
  const [myProfile, setMyProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (activeUser.current === me) return
    activeUser.current = me
    requestRef.current = null
    setFriendships([])
    setShares([])
    setProfiles(new Map())
    setNotes(new Map())
    setMyProfile(null)
    setLoading(false)
    setLoaded(false)
    setError('')
  }, [me])

  const load = useCallback((force = false) => {
    if (!me || (!force && loaded)) return Promise.resolve()
    if (requestRef.current) return requestRef.current
    const requestedBy = me
    setLoading(true)
    setError('')
    const request = Promise.all([
      friendshipService.listMyFriendships(),
      shareService.listMyCalendarShares(),
      noteService.listFriendNotes(),
      profileService.getMyProfile(),
    ]).then(async ([relations, grants, noteList, ownProfile]) => {
      const ids = new Set<string>()
      for (const relation of relations) { ids.add(relation.requesterId); ids.add(relation.addresseeId) }
      for (const grant of grants) { ids.add(grant.ownerId); ids.add(grant.viewerId) }
      ids.delete(me)
      const list = await profileService.listProfilesByIds([...ids])
      if (activeUser.current !== requestedBy) return
      setFriendships(relations)
      setShares(grants)
      setNotes(new Map(noteList.map((note) => [note.friendId, note])))
      setMyProfile(ownProfile)
      setProfiles(new Map(list.map((profile) => [profile.id, profile])))
      setLoaded(true)
    }).catch((reason) => {
      if (activeUser.current === requestedBy) {
        setError(getErrorMessage(reason, '好友数据加载失败'))
        setLoaded(true)
      }
    }).finally(() => {
      if (activeUser.current === requestedBy) setLoading(false)
      if (requestRef.current === request) requestRef.current = null
    })
    requestRef.current = request
    return request
  }, [loaded, me])

  const mutateRelationship = useCallback(async (action: () => Promise<unknown>) => {
    await action()
    invalidateCompanion()
    await load(true)
  }, [invalidateCompanion, load])

  const send = useCallback((addresseeId: string) => mutateRelationship(() => friendshipService.sendFriendRequest(addresseeId)), [mutateRelationship])
  const accept = useCallback((id: string) => mutateRelationship(() => friendshipService.respondToFriendRequest(id, true)), [mutateRelationship])
  const reject = useCallback((id: string) => mutateRelationship(() => friendshipService.respondToFriendRequest(id, false)), [mutateRelationship])
  const cancel = useCallback((id: string) => mutateRelationship(() => friendshipService.cancelFriendRequest(id)), [mutateRelationship])
  const remove = useCallback((id: string) => mutateRelationship(() => friendshipService.removeFriendship(id)), [mutateRelationship])
  const block = useCallback((id: string) => mutateRelationship(() => friendshipService.blockUser(id)), [mutateRelationship])
  const setShare = useCallback(async (viewerId: string, canView: boolean) => { await shareService.setCalendarShare(viewerId, canView); await load(true) }, [load])
  const saveNote = useCallback(async (friendId: string, remark: string) => { await noteService.saveFriendNote(friendId, remark); await load(true); invalidateCompanion() }, [invalidateCompanion, load])
  const updateProfile = useCallback(async (update: { displayName?: string; allowRequests?: boolean }) => {
    const profile = await profileService.updateMyProfile(update)
    setMyProfile(profile)
    return profile
  }, [])

  const value = useMemo(() => ({
    loading,
    loaded,
    error,
    me,
    myProfile,
    friendships,
    shares,
    profiles,
    notes,
    load,
    send,
    accept,
    reject,
    cancel,
    remove,
    block,
    setShare,
    saveNote,
    updateProfile,
  }), [loading, loaded, error, me, myProfile, friendships, shares, profiles, notes, load, send, accept, reject, cancel, remove, block, setShare, saveNote, updateProfile])

  return <FriendshipsContext.Provider value={value}>{children}</FriendshipsContext.Provider>
}

export function useFriendshipsData() {
  const value = useContext(FriendshipsContext)
  if (!value) throw new Error('好友数据必须在 FriendshipsProvider 内使用')
  return value
}
