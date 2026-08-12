import { getSupabase } from '../lib/supabase';
import { requireUser } from './auth';
import type { Database, Profile } from '../types';
import { AppError, toAppError } from '../utils/errorMessage';
import { isFriendCode, normalizeFriendCode } from '../utils/friendInvite';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export const mapProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  displayName: row.display_name,
  friendCode: row.friend_code,
  avatarUrl: row.avatar_url,
  allowRequests: row.allow_requests,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function getMyProfile(): Promise<Profile | null> {
  const user = await requireUser();
  try {
    const { data, error } = await getSupabase().from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) throw error;
    return data ? mapProfile(data) : null;
  } catch (error) {
    throw toAppError(error, '读取个人资料失败');
  }
}

/** Exact-match lookup by StudyBloom ID. Fuzzy/email search is intentionally not supported. */
export async function findProfileByFriendCode(code: string): Promise<Profile | null> {
  const value = normalizeFriendCode(code);
  if (!isFriendCode(value)) throw new AppError('StudyBloom ID 格式应为 BLOOM-XXXXXX', 'VALIDATION');
  await requireUser();
  try {
    const { data, error } = await getSupabase().from('profiles').select('*').eq('friend_code', value).maybeSingle();
    if (error) throw error;
    return data ? mapProfile(data) : null;
  } catch (error) {
    throw toAppError(error, '搜索用户失败');
  }
}

export async function listProfilesByIds(ids: string[]): Promise<Profile[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];
  await requireUser();
  try {
    const { data, error } = await getSupabase().from('profiles').select('*').in('id', unique);
    if (error) throw error;
    return (data ?? []).map(mapProfile);
  } catch (error) {
    throw toAppError(error, '读取用户资料失败');
  }
}

export async function updateMyProfile(update: { displayName?: string; allowRequests?: boolean }): Promise<Profile> {
  const user = await requireUser();
  const patch: Database['public']['Tables']['profiles']['Update'] = {};
  if (update.displayName !== undefined) {
    const name = update.displayName.trim();
    if (!name) throw new AppError('昵称不能为空', 'VALIDATION');
    if (name.length > 30) throw new AppError('昵称不能超过 30 个字符', 'VALIDATION');
    patch.display_name = name;
  }
  if (update.allowRequests !== undefined) patch.allow_requests = Boolean(update.allowRequests);
  if (!Object.keys(patch).length) throw new AppError('没有需要保存的修改', 'VALIDATION');
  try {
    const { data, error } = await getSupabase().from('profiles').update(patch).eq('id', user.id).select('*').single();
    if (error) throw error;
    return mapProfile(data);
  } catch (error) {
    throw toAppError(error, '保存个人资料失败');
  }
}
