import { getSupabase } from '../lib/supabase';
import { requireUser } from './auth';
import type { CalendarShare, Database } from '../types';
import { AppError, toAppError } from '../utils/errorMessage';

type ShareRow = Database['public']['Tables']['calendar_shares']['Row'];

export const mapCalendarShare = (row: ShareRow): CalendarShare => ({
  id: row.id,
  ownerId: row.owner_id,
  viewerId: row.viewer_id,
  canView: row.can_view,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Shares where I am the owner (grants I manage) or the viewer (grants given to me). */
export async function listMyCalendarShares(): Promise<CalendarShare[]> {
  const user = await requireUser();
  try {
    const { data, error } = await getSupabase()
      .from('calendar_shares')
      .select('*')
      .or(`owner_id.eq.${user.id},viewer_id.eq.${user.id}`);
    if (error) throw error;
    return (data ?? []).map(mapCalendarShare);
  } catch (error) {
    throw toAppError(error, '读取日历授权失败');
  }
}

/** Owner grants or revokes calendar access for an accepted friend. */
export async function setCalendarShare(viewerId: string, canView: boolean): Promise<CalendarShare> {
  const user = await requireUser();
  if (!viewerId.trim() || viewerId === user.id) throw new AppError('授权对象不正确', 'VALIDATION');
  try {
    const { data, error } = await getSupabase()
      .from('calendar_shares')
      .upsert({ owner_id: user.id, viewer_id: viewerId, can_view: Boolean(canView) }, { onConflict: 'owner_id,viewer_id' })
      .select('*')
      .single();
    if (error) throw error;
    return mapCalendarShare(data);
  } catch (error) {
    if (/row-level security/i.test((error as { message?: string })?.message ?? '')) {
      throw new AppError('只能授权给已是好友的用户', 'FORBIDDEN');
    }
    throw toAppError(error, '保存日历授权失败');
  }
}

/** Does the owner currently share their calendar with me? */
export async function canViewFriendCalendar(ownerId: string): Promise<boolean> {
  const user = await requireUser();
  if (!ownerId.trim()) return false;
  try {
    const { data, error } = await getSupabase()
      .from('calendar_shares')
      .select('can_view')
      .eq('owner_id', ownerId)
      .eq('viewer_id', user.id)
      .eq('can_view', true)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  } catch (error) {
    throw toAppError(error, '读取日历授权失败');
  }
}
