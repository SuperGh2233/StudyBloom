import type { DateKey } from '../types'
import { dateKeyToDate, todayDateKey } from './date'

export function countdownDays(targetDate: DateKey, today: DateKey = todayDateKey()): number {
  return Math.round((dateKeyToDate(targetDate).getTime() - dateKeyToDate(today).getTime()) / 86_400_000)
}
