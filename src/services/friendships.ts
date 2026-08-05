import { getSupabase } from '../lib/supabase';
import { requireUser } from './auth';
import type { Database, Friendship } from '../types';
import { AppError, toAppError } from '../utils/errorMessage';

type FriendshipRow = Database['public']['Tables']['friendships']['Row'];

export const mapFriendship = (row: FriendshipRow): Friendship => ({
  id: row.id,
  requesterId: row.requester_id,
  addresseeId: row.addressee_id,
  status: row.status,
  createdAt: row.created_at,
  respondedAt: row.responded_at,
});

/** Every relation where I am the requester or the addressee. */
export async function listMyFriendships(): Promise<Friendship[]> {
  const user = await requireUser();
  try {
    const { data, error } = await getSupabase()
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    if (error) throw error;
    return (data ?? []).map(mapFriendship);
  } catch (error) {
    throw toAppError(error, '读取好友关系失败');
  }
}

export async function sendFriendRequest(addresseeId: string): Promise<Friendship> {
  const user = await requireUser();
  if (!addresseeId.trim()) throw new AppError('用户不存在', 'VALIDATION');
  if (addresseeId === user.id) throw new AppError('不能添加自己为好友', 'VALIDATION');
  try {
    const { data, error } = await getSupabase()
      .from('friendships')
      .insert({ requester_id: user.id, addressee_id: addresseeId, status: 'pending' })
      .select('*')
      .single();
    if (error) throw error;
    return mapFriendship(data);
  } catch (error) {
    if (toAppError(error).code === 'CONFLICT') throw new AppError('你们之间已有好友申请或已是好友', 'CONFLICT');
    if (/row-level security/i.test((error as { message?: string })?.message ?? '')) {
      throw new AppError('对方暂未开放好友申请', 'FORBIDDEN');
    }
    throw toAppError(error, '发送好友申请失败');
  }
}

/** Only the addressee can answer; RLS enforces this even if the filter is bypassed. */
export async function respondToFriendRequest(id: string, accept: boolean): Promise<void> {
  if (!id.trim()) throw new AppError('申请不存在', 'VALIDATION');
  const user = await requireUser();
  try {
    const { data, error } = await getSupabase()
      .from('friendships')
      .update({ status: accept ? 'accepted' : 'rejected', responded_at: new Date().toISOString() })
      .eq('id', id)
      .eq('addressee_id', user.id)
      .eq('status', 'pending')
      .select('id');
    if (error) throw error;
    if (!data?.length) throw new AppError('该申请不存在或已处理', 'VALIDATION');
  } catch (error) {
    throw toAppError(error, accept ? '接受好友申请失败' : '拒绝好友申请失败');
  }
}

/** Only the requester can cancel their own pending request. */
export async function cancelFriendRequest(id: string): Promise<void> {
  if (!id.trim()) throw new AppError('申请不存在', 'VALIDATION');
  const user = await requireUser();
  try {
    const { data, error } = await getSupabase()
      .from('friendships')
      .delete()
      .eq('id', id)
      .eq('requester_id', user.id)
      .eq('status', 'pending')
      .select('id');
    if (error) throw error;
    if (!data?.length) throw new AppError('该申请不存在或已处理', 'VALIDATION');
  } catch (error) {
    throw toAppError(error, '取消好友申请失败');
  }
}

/** Either side may remove an accepted friendship; the DB trigger clears shares. */
export async function removeFriendship(id: string): Promise<void> {
  if (!id.trim()) throw new AppError('好友关系不存在', 'VALIDATION');
  await requireUser();
  try {
    const { data, error } = await getSupabase()
      .from('friendships')
      .delete()
      .eq('id', id)
      .eq('status', 'accepted')
      .select('id');
    if (error) throw error;
    if (!data?.length) throw new AppError('好友关系不存在或已删除', 'VALIDATION');
  } catch (error) {
    throw toAppError(error, '删除好友失败');
  }
}

/** Either side may block a pending or accepted relation; the pair index then
 *  prevents new requests until the blocked row is removed. */
export async function blockUser(id: string): Promise<void> {
  if (!id.trim()) throw new AppError('记录不存在', 'VALIDATION');
  await requireUser();
  try {
    const { data, error } = await getSupabase()
      .from('friendships')
      .update({ status: 'blocked' })
      .eq('id', id)
      .in('status', ['pending', 'accepted'])
      .select('id');
    if (error) throw error;
    if (!data?.length) throw new AppError('该记录不存在或已处理', 'VALIDATION');
  } catch (error) {
    throw toAppError(error, '拉黑失败');
  }
}
