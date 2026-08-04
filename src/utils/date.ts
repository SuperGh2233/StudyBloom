import type { DateKey, DateRange } from '../types';

const UTC8_OFFSET_MS = 8 * 60 * 60 * 1000;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

const pad = (value: number) => String(value).padStart(2, '0');

/** Format an instant as the calendar date in Asia/Shanghai (UTC+8). */
export function formatDateKey(value: Date | number = new Date()): DateKey {
  const timestamp = value instanceof Date ? value.getTime() : value;
  if (!Number.isFinite(timestamp)) throw new RangeError('Invalid date');
  const shanghai = new Date(timestamp + UTC8_OFFSET_MS);
  return `${shanghai.getUTCFullYear()}-${pad(shanghai.getUTCMonth() + 1)}-${pad(shanghai.getUTCDate())}`;
}

export const todayDateKey = (now: Date = new Date()): DateKey => formatDateKey(now);

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string' || !DATE_KEY_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

export function assertDateKey(value: unknown, field = '日期'): DateKey {
  if (!isDateKey(value)) throw new RangeError(`${field}必须是有效的 YYYY-MM-DD`);
  return value;
}

export function isMonthKey(value: unknown): value is string {
  if (typeof value !== 'string' || !MONTH_KEY_RE.test(value)) return false;
  const month = Number(value.slice(5));
  return month >= 1 && month <= 12;
}

export function assertMonthKey(value: unknown, field = '月份'): string {
  if (!isMonthKey(value)) throw new RangeError(`${field}必须是有效的 YYYY-MM`);
  return value;
}

export function dateKeyToDate(value: DateKey): Date {
  assertDateKey(value);
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function dateKeyFromParts(year: number, month: number, day: number): DateKey {
  const key = `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
  return assertDateKey(key);
}

export function addDays(value: DateKey, amount: number): DateKey {
  assertDateKey(value);
  if (!Number.isInteger(amount)) throw new RangeError('日期偏移量必须是整数');
  const date = dateKeyToDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKeyFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function compareDateKeys(left: DateKey, right: DateKey): number {
  assertDateKey(left);
  assertDateKey(right);
  return left < right ? -1 : left > right ? 1 : 0;
}

export function monthKeyFromDate(value: Date | number = new Date()): string {
  return formatDateKey(value).slice(0, 7);
}

export function monthKeyFromDateKey(value: DateKey): string {
  assertDateKey(value);
  return value.slice(0, 7);
}

export function monthRange(month: string): DateRange {
  assertMonthKey(month);
  const [year, monthNumber] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0));
  return {
    startDate: `${month}-01`,
    endDate: dateKeyFromParts(last.getUTCFullYear(), last.getUTCMonth() + 1, last.getUTCDate()),
  };
}

export function enumerateDateKeys(startDate: DateKey, endDate: DateKey): DateKey[] {
  assertDateKey(startDate);
  assertDateKey(endDate);
  if (compareDateKeys(startDate, endDate) > 0) return [];
  const result: DateKey[] = [];
  let cursor = startDate;
  // ponytail: cap untrusted imports/ranges at ten years; raise only for a real reporting need.
  for (let index = 0; compareDateKeys(cursor, endDate) <= 0 && index <= 3660; index += 1) {
    result.push(cursor);
    cursor = addDays(cursor, 1);
  }
  if (result[result.length - 1] !== endDate) throw new RangeError('日期范围不能超过十年');
  return result;
}

