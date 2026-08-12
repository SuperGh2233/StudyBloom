import { beforeEach, describe, expect, it } from 'vitest'
import type { Friendship } from '../types'
import { buildFriendInviteUrl, clearPendingInvite, inviteCodeFromSearch, readPendingInvite, rememberPendingInvite, resolveFriendInviteState } from './friendInvite'

describe('friend invite link', () => {
  beforeEach(() => localStorage.clear())

  it('parses and normalizes an invite code', () => {
    expect(inviteCodeFromSearch('?invite=bloom-ab12cd')).toBe('BLOOM-AB12CD')
    expect(inviteCodeFromSearch('?invite=invalid')).toBeNull()
  })

  it('keeps an invite through login until it is handled', () => {
    rememberPendingInvite('bloom-ab12cd')
    expect(readPendingInvite()).toBe('BLOOM-AB12CD')
    clearPendingInvite()
    expect(readPendingInvite()).toBeNull()
  })

  it('builds a same-origin friends link', () => {
    expect(buildFriendInviteUrl('BLOOM-AB12CD', 'https://study.example')).toBe('https://study.example/friends?invite=BLOOM-AB12CD')
  })

  it('recognizes self, existing friend and pending invitation states', () => {
    const accepted: Friendship = { id: 'r1', requesterId: 'me', addresseeId: 'friend', status: 'accepted', createdAt: '', respondedAt: null }
    const incoming: Friendship = { ...accepted, id: 'r2', requesterId: 'friend', addresseeId: 'me', status: 'pending' }
    const outgoing: Friendship = { ...accepted, id: 'r3', status: 'pending' }

    expect(resolveFriendInviteState('me', 'me', undefined, true)).toBe('self')
    expect(resolveFriendInviteState('friend', 'me', accepted, true)).toBe('accepted')
    expect(resolveFriendInviteState('friend', 'me', incoming, true)).toBe('incoming-pending')
    expect(resolveFriendInviteState('friend', 'me', outgoing, true)).toBe('outgoing-pending')
  })
})
