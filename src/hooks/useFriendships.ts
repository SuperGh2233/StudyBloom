import { useCallback, useEffect, useMemo } from 'react'
import { useFriendshipsData } from '../features/friends/FriendshipsContext'
import type { Friendship } from '../types'

/** Shared friend data + actions; every mutation reloads so RLS stays the source of truth. */
export function useFriendships() {
  const data = useFriendshipsData()
  const { me, friendships, shares, load } = data
  useEffect(() => { void load() }, [load])

  const counterpartId = useCallback((relation: Friendship) => (relation.requesterId === me ? relation.addresseeId : relation.requesterId), [me])
  const friends = useMemo(() => friendships.filter((relation) => relation.status === 'accepted'), [friendships])
  const incoming = useMemo(() => friendships.filter((relation) => relation.status === 'pending' && relation.addresseeId === me), [friendships, me])
  const outgoing = useMemo(() => friendships.filter((relation) => relation.status === 'pending' && relation.requesterId === me), [friendships, me])
  const sharedToMe = useMemo(() => new Set(shares.filter((grant) => grant.viewerId === me && grant.canView).map((grant) => grant.ownerId)), [shares, me])
  const grantedByMe = useMemo(() => new Set(shares.filter((grant) => grant.ownerId === me && grant.canView).map((grant) => grant.viewerId)), [shares, me])
  const relationWith = useCallback((userId: string) => friendships.find((relation) => relation.requesterId === userId || relation.addresseeId === userId), [friendships])

  return { ...data, loading: data.loading || !data.loaded, friends, incoming, outgoing, sharedToMe, grantedByMe, counterpartId, relationWith, reload: () => load(true) }
}
