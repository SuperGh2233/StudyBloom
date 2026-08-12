import { getSupabase } from '../lib/supabase'
import type {
  CompanionDaySummary,
  CompanionEncouragement,
  CompanionExperienceMode,
  CompanionPreferences,
  CompanionSetting,
  CompanionShareLevel,
  CompanionWeeklySummary,
  Database,
  DateKey,
} from '../types'
import { assertDateKey } from '../utils/date'
import { AppError, toAppError } from '../utils/errorMessage'
import { withWeeklyText } from '../features/companionship/companionUtils'
import { requireUser } from './auth'

type PreferenceRow = Database['public']['Tables']['companion_preferences']['Row']
type SettingRow = Database['public']['Tables']['companion_settings']['Row']
type EncouragementRow = Database['public']['Tables']['companion_encouragements']['Row']

const mapPreferences = (row: PreferenceRow): CompanionPreferences => ({
  userId: row.user_id,
  primaryCompanionId: row.primary_companion_id,
  experienceMode: row.experience_mode,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const mapSetting = (row: SettingRow): CompanionSetting => ({
  ownerId: row.owner_id,
  companionId: row.companion_id,
  shareLevel: row.share_level,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const mapEncouragement = (row: EncouragementRow): CompanionEncouragement => ({
  id: row.id,
  senderId: row.sender_id,
  recipientId: row.recipient_id,
  sentOn: row.sent_on,
  kind: row.kind,
  createdAt: row.created_at,
})

export async function getCompanionPreferences(): Promise<CompanionPreferences> {
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase().from('companion_preferences').select('*').eq('user_id', user.id).maybeSingle()
    if (error) throw error
    return data ? mapPreferences(data) : {
      userId: user.id,
      primaryCompanionId: null,
      experienceMode: 'study_together',
      createdAt: '',
      updatedAt: '',
    }
  } catch (error) { throw toAppError(error, '读取搭子偏好失败') }
}

export async function saveCompanionPreferences(update: { primaryCompanionId?: string | null; experienceMode?: CompanionExperienceMode }): Promise<CompanionPreferences> {
  const user = await requireUser()
  if (update.primaryCompanionId === user.id) throw new AppError('不能把自己设为首页搭子', 'VALIDATION')
  if (update.experienceMode && !['study_together', 'supporter'].includes(update.experienceMode)) throw new AppError('搭子使用方式不正确', 'VALIDATION')
  try {
    const { data, error } = await getSupabase().from('companion_preferences').upsert({
      user_id: user.id,
      ...(update.primaryCompanionId !== undefined && { primary_companion_id: update.primaryCompanionId }),
      ...(update.experienceMode !== undefined && { experience_mode: update.experienceMode }),
    }, { onConflict: 'user_id' }).select('*').single()
    if (error) throw error
    return mapPreferences(data)
  } catch (error) { throw toAppError(error, '保存搭子偏好失败') }
}

export async function listCompanionSettings(): Promise<CompanionSetting[]> {
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase().from('companion_settings').select('*').or(`owner_id.eq.${user.id},companion_id.eq.${user.id}`)
    if (error) throw error
    return (data ?? []).map(mapSetting)
  } catch (error) { throw toAppError(error, '读取搭子分享设置失败') }
}

export async function setCompanionShareLevel(companionId: string, shareLevel: CompanionShareLevel): Promise<CompanionSetting> {
  const user = await requireUser()
  if (!companionId || companionId === user.id) throw new AppError('搭子参数不正确', 'VALIDATION')
  if (!['none', 'bloom_only', 'summary'].includes(shareLevel)) throw new AppError('分享范围不正确', 'VALIDATION')
  try {
    const { data, error } = await getSupabase().from('companion_settings').upsert({ owner_id: user.id, companion_id: companionId, share_level: shareLevel }, { onConflict: 'owner_id,companion_id' }).select('*').single()
    if (error) throw error
    return mapSetting(data)
  } catch (error) { throw toAppError(error, '保存分享范围失败') }
}

export async function getCompanionSummary(companionId: string, startDate: DateKey, endDate: DateKey): Promise<CompanionDaySummary[]> {
  assertDateKey(startDate); assertDateKey(endDate)
  await requireUser()
  try {
    const { data, error } = await getSupabase().rpc('get_companion_summary', { p_target_user_id: companionId, p_start_date: startDate, p_end_date: endDate })
    if (error) throw error
    return (data ?? []).map((row) => ({
      date: row.summary_date,
      effectiveStudy: row.effective_study,
      studiedMinutes: row.studied_minutes,
      completedTasks: row.completed_tasks,
      totalTasks: row.total_tasks,
    }))
  } catch (error) { throw toAppError(error, '读取搭子概要失败') }
}

export async function getCompanionWeeklySummary(companionId: string): Promise<CompanionWeeklySummary | null> {
  await requireUser()
  try {
    const { data, error } = await getSupabase().rpc('get_companion_weekly_summary', { p_target_user_id: companionId })
    if (error) throw error
    const row = data?.[0]
    return row ? withWeeklyText({ weekBloomDays: row.week_bloom_days, totalBloomDays: row.total_bloom_days, weekMutualFlowerDays: row.week_mutual_flower_days, milestone: row.milestone }) : null
  } catch (error) { throw toAppError(error, '读取双人周记失败') }
}

export async function listCompanionEncouragements(startDate: DateKey, endDate: DateKey): Promise<CompanionEncouragement[]> {
  assertDateKey(startDate); assertDateKey(endDate)
  await requireUser()
  try {
    const { data, error } = await getSupabase().from('companion_encouragements').select('*').gte('sent_on', startDate).lte('sent_on', endDate).order('sent_on', { ascending: true })
    if (error) throw error
    return (data ?? []).map(mapEncouragement)
  } catch (error) { throw toAppError(error, '读取搭子小花失败') }
}

export async function sendCompanionFlower(recipientId: string): Promise<CompanionEncouragement> {
  if (!recipientId.trim()) throw new AppError('搭子不存在', 'VALIDATION')
  await requireUser()
  try {
    const { data, error } = await getSupabase().rpc('send_companion_flower', { p_recipient_id: recipientId })
    if (error) throw error
    return mapEncouragement(data)
  } catch (error) { throw toAppError(error, '送出小花失败') }
}

