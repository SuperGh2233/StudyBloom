import { getSupabase } from '../lib/supabase'
import type { Database, FriendNote } from '../types'
import { AppError, toAppError } from '../utils/errorMessage'
import { requireUser } from './auth'

type FriendNoteRow = Database['public']['Tables']['friend_notes']['Row']

export const mapFriendNote = (row: FriendNoteRow): FriendNote => ({
  ownerId: row.owner_id,
  friendId: row.friend_id,
  remark: row.remark,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export function normalizeFriendRemark(value: string): string {
  const remark = value.trim()
  if (remark.length > 30) throw new AppError('好友备注不能超过 30 个字符', 'VALIDATION')
  return remark
}

export async function listFriendNotes(): Promise<FriendNote[]> {
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase().from('friend_notes').select('*').eq('owner_id', user.id)
    if (error) throw error
    return (data ?? []).map(mapFriendNote)
  } catch (error) { throw toAppError(error, '读取好友备注失败') }
}

export async function getFriendNote(friendId: string): Promise<FriendNote | null> {
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase().from('friend_notes').select('*').eq('owner_id', user.id).eq('friend_id', friendId).maybeSingle()
    if (error) throw error
    return data ? mapFriendNote(data) : null
  } catch (error) { throw toAppError(error, '读取好友备注失败') }
}

export async function saveFriendNote(friendId: string, value: string): Promise<void> {
  if (!friendId.trim()) throw new AppError('好友 ID 不能为空', 'VALIDATION')
  const user = await requireUser()
  const remark = normalizeFriendRemark(value)
  try {
    const client = getSupabase()
    const result = remark
      ? await client.from('friend_notes').upsert({ owner_id: user.id, friend_id: friendId, remark }, { onConflict: 'owner_id,friend_id' })
      : await client.from('friend_notes').delete().eq('owner_id', user.id).eq('friend_id', friendId)
    if (result.error) throw result.error
  } catch (error) { throw toAppError(error, remark ? '保存好友备注失败' : '清除好友备注失败') }
}
