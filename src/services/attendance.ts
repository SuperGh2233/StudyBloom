import { getSupabase } from '../lib/supabase'
import { requireUser } from './auth'
import type { AttendanceRecord, Database, GeoPoint, StudyLocation, StudyLocationInput, StudyLocationUpdate } from '../types'
import { LOCATION_LIMITS } from '../types'
import { addDays, assertDateKey } from '../utils/date'
import { AppError, toAppError } from '../utils/errorMessage'
import { assertAccuracy } from '../utils/geolocation'

type LocationRow = Database['public']['Tables']['study_locations']['Row']
type AttendanceRow = Database['public']['Tables']['attendance_records']['Row']

export const mapStudyLocation = (row: LocationRow): StudyLocation => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  latitude: row.latitude,
  longitude: row.longitude,
  radiusM: row.radius_m,
  isActive: row.is_active,
  isDefault: row.is_default,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

/** Coordinates are intentionally NOT mapped into the business type: the UI must never display historical positions. */
export const mapAttendanceRecord = (row: AttendanceRow): AttendanceRecord => ({
  id: row.id,
  userId: row.user_id,
  locationId: row.location_id,
  checkInAt: row.check_in_at,
  checkInAccuracyM: row.check_in_accuracy_m,
  checkInDistanceM: row.check_in_distance_m,
  checkOutAt: row.check_out_at,
  checkOutAccuracyM: row.check_out_accuracy_m,
  checkOutDistanceM: row.check_out_distance_m,
  manualClosed: row.manual_closed,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const validateLocationName = (name: string): string => {
  const value = name.trim()
  if (!value) throw new AppError('地点名称不能为空', 'VALIDATION')
  if (value.length > 50) throw new AppError('地点名称不能超过 50 个字符', 'VALIDATION')
  return value
}

export const clampRadiusM = (value: number | undefined): number => {
  if (value === undefined || !Number.isFinite(value)) return LOCATION_LIMITS.radiusDefaultM
  return Math.min(LOCATION_LIMITS.radiusMaxM, Math.max(LOCATION_LIMITS.radiusMinM, Math.round(value)))
}

export async function listMyStudyLocations(): Promise<StudyLocation[]> {
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase()
      .from('study_locations')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map(mapStudyLocation)
  } catch (error) { throw toAppError(error, '读取学习地点失败') }
}

export async function createStudyLocation(input: StudyLocationInput): Promise<StudyLocation> {
  const name = validateLocationName(input.name)
  const user = await requireUser()
  try {
    const client = getSupabase()
    const { data: existing, error: listError } = await client.from('study_locations').select('id').eq('user_id', user.id)
    if (listError) throw listError
    const isFirst = (existing ?? []).length === 0
    const { data, error } = await client
      .from('study_locations')
      .insert({
        user_id: user.id,
        name,
        latitude: input.latitude,
        longitude: input.longitude,
        radius_m: clampRadiusM(input.radiusM),
        is_default: isFirst,
      })
      .select('*')
      .single()
    if (error) throw error
    return mapStudyLocation(data)
  } catch (error) { throw toAppError(error, '创建学习地点失败') }
}

export async function updateStudyLocation(id: string, input: StudyLocationUpdate): Promise<StudyLocation> {
  if (!id.trim()) throw new AppError('地点 ID 不能为空', 'VALIDATION')
  const user = await requireUser()
  const update: Database['public']['Tables']['study_locations']['Update'] = {}
  if (input.name !== undefined) update.name = validateLocationName(input.name)
  if (input.radiusM !== undefined) update.radius_m = clampRadiusM(input.radiusM)
  if (input.latitude !== undefined) update.latitude = input.latitude
  if (input.longitude !== undefined) update.longitude = input.longitude
  if (input.isActive !== undefined) update.is_active = Boolean(input.isActive)
  if (!Object.keys(update).length) throw new AppError('没有需要更新的地点字段', 'VALIDATION')
  try {
    const { data, error } = await getSupabase()
      .from('study_locations')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single()
    if (error) throw error
    return mapStudyLocation(data)
  } catch (error) { throw toAppError(error, '更新学习地点失败') }
}

/** Set the default location; the previous default is cleared first. */
export async function setDefaultStudyLocation(id: string): Promise<void> {
  if (!id.trim()) throw new AppError('地点 ID 不能为空', 'VALIDATION')
  const user = await requireUser()
  try {
    const client = getSupabase()
    const { data: current, error: fetchError } = await client.from('study_locations').select('id,is_default').eq('user_id', user.id)
    if (fetchError) throw fetchError
    const previousDefaults = (current ?? []).filter((row) => row.is_default && row.id !== id).map((row) => row.id)
    if (previousDefaults.length) {
      const { error } = await client.from('study_locations').update({ is_default: false }).eq('user_id', user.id).in('id', previousDefaults)
      if (error) throw error
    }
    const { error } = await client.from('study_locations').update({ is_default: true }).eq('user_id', user.id).eq('id', id)
    if (error) throw error
  } catch (error) { throw toAppError(error, '设置默认地点失败') }
}

// ---------------------------------------------------------------------------
// Check-in / check-out go through database RPCs: the database recomputes the
// distance, re-validates accuracy and writes database time.
// ---------------------------------------------------------------------------

export async function checkInAtLocation(locationId: string, point: GeoPoint): Promise<AttendanceRecord> {
  if (!locationId.trim()) throw new AppError('请先选择学习地点', 'VALIDATION')
  assertAccuracy(point)
  await requireUser()
  try {
    const { data, error } = await getSupabase().rpc('check_in_at_location', {
      p_location_id: locationId,
      p_latitude: point.latitude,
      p_longitude: point.longitude,
      p_accuracy_m: point.accuracyM,
    })
    if (error) throw error
    return mapAttendanceRecord(data)
  } catch (error) { throw toAppError(error, '签到失败') }
}

export async function checkOutFromLocation(point: GeoPoint): Promise<AttendanceRecord> {
  assertAccuracy(point)
  await requireUser()
  try {
    const { data, error } = await getSupabase().rpc('check_out_from_location', {
      p_latitude: point.latitude,
      p_longitude: point.longitude,
      p_accuracy_m: point.accuracyM,
    })
    if (error) throw error
    return mapAttendanceRecord(data)
  } catch (error) { throw toAppError(error, '签退失败') }
}

/** Secondary exit when the user forgot to check out. Not valid presence time. */
export async function forceCloseAttendance(): Promise<AttendanceRecord> {
  await requireUser()
  try {
    const { data, error } = await getSupabase().rpc('force_close_attendance')
    if (error) throw error
    return mapAttendanceRecord(data)
  } catch (error) { throw toAppError(error, '结束签到记录失败') }
}

export async function getOpenAttendanceRecord(): Promise<AttendanceRecord | null> {
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase()
      .from('attendance_records')
      .select('*')
      .eq('user_id', user.id)
      .is('check_out_at', null)
      .order('check_in_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data ? mapAttendanceRecord(data) : null
  } catch (error) { throw toAppError(error, '读取签到状态失败') }
}

export async function listMyAttendanceRecords(limit = 20): Promise<AttendanceRecord[]> {
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase()
      .from('attendance_records')
      .select('*')
      .eq('user_id', user.id)
      .order('check_in_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map(mapAttendanceRecord)
  } catch (error) { throw toAppError(error, '读取签到记录失败') }
}

/** Attendance for one local day (check-in time within the day, UTC+8). */
export async function listAttendanceRecordsByDate(planDate: string): Promise<AttendanceRecord[]> {
  assertDateKey(planDate)
  const nextDate = addDays(planDate, 1)
  const user = await requireUser()
  try {
    const { data, error } = await getSupabase()
      .from('attendance_records')
      .select('*')
      .eq('user_id', user.id)
      .gte('check_in_at', `${planDate}T00:00:00+08:00`)
      .lt('check_in_at', `${nextDate}T00:00:00+08:00`)
      .order('check_in_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map(mapAttendanceRecord)
  } catch (error) { throw toAppError(error, '读取签到记录失败') }
}
