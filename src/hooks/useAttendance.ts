import { useCallback, useEffect, useState } from 'react'
import * as attendanceService from '../services/attendance'
import type { AttendanceRecord, GeoPoint, StudyLocation } from '../types'
import { getErrorMessage } from '../utils/errorMessage'

/** Shared location/attendance state for the study page and settings. */
export function useAttendance() {
  const [locations, setLocations] = useState<StudyLocation[]>([])
  const [openRecord, setOpenRecord] = useState<AttendanceRecord | null>(null)
  const [recentRecords, setRecentRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    setError('')
    try {
      const [nextLocations, nextOpen, nextRecent] = await Promise.all([
        attendanceService.listMyStudyLocations(),
        attendanceService.getOpenAttendanceRecord(),
        attendanceService.listMyAttendanceRecords(10),
      ])
      setLocations(nextLocations)
      setOpenRecord(nextOpen)
      setRecentRecords(nextRecent)
    } catch (reason) {
      setError(getErrorMessage(reason, '读取地点签到信息失败'))
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const checkIn = useCallback(async (locationId: string, point: GeoPoint) => {
    const record = await attendanceService.checkInAtLocation(locationId, point)
    await load(true)
    return record
  }, [load])

  const checkOut = useCallback(async (point: GeoPoint) => {
    const record = await attendanceService.checkOutFromLocation(point)
    await load(true)
    return record
  }, [load])

  const forceClose = useCallback(async () => {
    await attendanceService.forceCloseAttendance()
    await load(true)
  }, [load])

  return { locations, openRecord, recentRecords, loading, error, reload: load, checkIn, checkOut, forceClose }
}
