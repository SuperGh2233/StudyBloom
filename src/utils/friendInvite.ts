import type { Friendship } from '../types'

const FRIEND_CODE_RE = /^BLOOM-[A-Z0-9]{6}$/
const PENDING_INVITE_KEY = 'studybloom:pending-friend-invite:v1'

export type FriendInviteState = 'self' | 'accepted' | 'outgoing-pending' | 'incoming-pending' | 'blocked' | 'unavailable' | 'available'

export function resolveFriendInviteState(profileId: string, myId: string | null, relation: Friendship | undefined, allowRequests: boolean): FriendInviteState {
  if (profileId === myId) return 'self'
  if (relation?.status === 'accepted') return 'accepted'
  if (relation?.status === 'pending') return relation.requesterId === myId ? 'outgoing-pending' : 'incoming-pending'
  if (relation?.status === 'blocked') return 'blocked'
  return allowRequests ? 'available' : 'unavailable'
}

export function normalizeFriendCode(value: string): string {
  return value.trim().toUpperCase()
}

export function isFriendCode(value: string): boolean {
  return FRIEND_CODE_RE.test(normalizeFriendCode(value))
}

export function inviteCodeFromSearch(search: string): string | null {
  const code = normalizeFriendCode(new URLSearchParams(search).get('invite') ?? '')
  return isFriendCode(code) ? code : null
}

export function buildFriendInviteUrl(friendCode: string, origin = window.location.origin): string {
  const code = normalizeFriendCode(friendCode)
  if (!isFriendCode(code)) throw new Error('StudyBloom ID 格式不正确')
  const url = new URL('/friends', origin)
  url.searchParams.set('invite', code)
  return url.toString()
}

function localStore(): Storage | null {
  try { return window.localStorage } catch { return null }
}

export function rememberPendingInvite(friendCode: string, storage = localStore()): void {
  if (!storage || !isFriendCode(friendCode)) return
  try { storage.setItem(PENDING_INVITE_KEY, normalizeFriendCode(friendCode)) } catch { /* 无存储时仍可通过当前 URL 继续 */ }
}

export function readPendingInvite(storage = localStore()): string | null {
  if (!storage) return null
  try {
    const code = storage.getItem(PENDING_INVITE_KEY) ?? ''
    return isFriendCode(code) ? normalizeFriendCode(code) : null
  } catch { return null }
}

export function clearPendingInvite(storage = localStore()): void {
  if (!storage) return
  try { storage.removeItem(PENDING_INVITE_KEY) } catch { /* 无需阻塞主流程 */ }
}
