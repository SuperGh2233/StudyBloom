import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../features/auth/AuthContext'
import * as shareService from '../services/calendarShares'
import * as friendshipService from '../services/friendships'
import * as profileService from '../services/profiles'
import type { CalendarShare, Friendship, Profile } from '../types'
import { getErrorMessage } from '../utils/errorMessage'

/** Shared friend data + actions; every mutation reloads so RLS stays the source of truth. */
export function useFriendships() {
  const { user } = useAuth()
  const me = user?.id ?? ''
  const [friendships, setFriendships] = useState<Friendship[]>([])
  const [shares, setShares] = useState<CalendarShare[]>([])
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!me) return
    setLoading(true); setError('')
    try {
      const [relations, grants] = await Promise.all([friendshipService.listMyFriendships(), shareService.listMyCalendarShares()])
      setFriendships(relations); setShares(grants)
      const ids = new Set<string>()
      for (const relation of relations) { ids.add(relation.requesterId); ids.add(relation.addresseeId) }
      for (const grant of grants) { ids.add(grant.ownerId); ids.add(grant.viewerId) }
      ids.delete(me)
      const list = await profileService.listProfilesByIds([...ids])
      setProfiles(new Map(list.map((profile) => [profile.id, profile])))
    } catch (reason) { setError(getErrorMessage(reason, '好友数据加载失败')) }
    finally { setLoading(false) }
  }, [me])
  useEffect(() => { void load() }, [load])

  const counterpartId = useCallback((relation: Friendship) => (relation.requesterId === me ? relation.addresseeId : relation.requesterId), [me])
  const friends = useMemo(() => friendships.filter((relation) => relation.status === 'accepted'), [friendships])
  const incoming = useMemo(() => friendships.filter((relation) => relation.status === 'pending' && relation.addresseeId === me), [friendships, me])
  const outgoing = useMemo(() => friendships.filter((relation) => relation.status === 'pending' && relation.requesterId === me), [friendships, me])
  const sharedToMe = useMemo(() => new Set(shares.filter((grant) => grant.viewerId === me && grant.canView).map((grant) => grant.ownerId)), [shares, me])
  const grantedByMe = useMemo(() => new Set(shares.filter((grant) => grant.ownerId === me && grant.canView).map((grant) => grant.viewerId)), [shares, me])
  const relationWith = useCallback((userId: string) => friendships.find((relation) => relation.requesterId === userId || relation.addresseeId === userId), [friendships])

  const send = useCallback(async (addresseeId: string) => { await friendshipService.sendFriendRequest(addresseeId); await load() }, [load])
  const accept = useCallback(async (id: string) => { await friendshipService.respondToFriendRequest(id, true); await load() }, [load])
  const reject = useCallback(async (id: string) => { await friendshipService.respondToFriendRequest(id, false); await load() }, [load])
  const cancel = useCallback(async (id: string) => { await friendshipService.cancelFriendRequest(id); await load() }, [load])
  const remove = useCallback(async (id: string) => { await friendshipService.removeFriendship(id); await load() }, [load])
  const block = useCallback(async (id: string) => { await friendshipService.blockUser(id); await load() }, [load])
  const setShare = useCallback(async (viewerId: string, canView: boolean) => { await shareService.setCalendarShare(viewerId, canView); await load() }, [load])

  return { loading, error, me, friendships, profiles, friends, incoming, outgoing, sharedToMe, grantedByMe, counterpartId, relationWith, reload: load, send, accept, reject, cancel, remove, block, setShare }
}
