import { format } from 'date-fns'
import { History, MapPin } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { LoadingState } from '../../components/LoadingState'
import type { AttendanceRecord, StudyLocation, StudySession, StudySessionSegment } from '../../types'
import { formatDurationHuman, totalSegmentSeconds } from '../../utils/studyDuration'

interface StudyRecordsProps {
  sessions: StudySession[]
  segments: StudySessionSegment[]
  /** Today's attendance rows, only used to resolve a session's location name. */
  todayAttendance: AttendanceRecord[]
  recentRecords: AttendanceRecord[]
  locations: StudyLocation[]
  nowMs: number
  loading: boolean
}

const timeHm = (iso: string) => format(new Date(iso), 'HH:mm')

export function StudyRecords({ sessions, segments, todayAttendance, recentRecords, locations, nowMs, loading }: StudyRecordsProps) {
  const locationNameById = useMemo(() => new Map(locations.map((location) => [location.id, location.name])), [locations])
  const attendanceById = useMemo(() => new Map(todayAttendance.map((record) => [record.id, record])), [todayAttendance])

  return (
    <div className="grid min-w-0 gap-5">
      <section className="surface min-w-0 rounded-2xl p-5" aria-label="今日学习记录">
        <h2 className="flex items-center gap-2 font-bold"><History size={18} className="text-[var(--accent-strong)]" />今日学习记录</h2>
        {loading && !sessions.length ? (
          <LoadingState label="正在整理学习记录..." />
        ) : !sessions.length ? (
          <p className="mt-4 text-sm text-[var(--muted)]">今天还没有学习记录，慢慢开始第一步。</p>
        ) : (
          <ul className="mt-4 grid gap-2.5">
            {sessions.map((session) => {
              const seconds = totalSegmentSeconds(segments.filter((segment) => segment.sessionId === session.id), nowMs)
              const attendance = session.attendanceRecordId ? attendanceById.get(session.attendanceRecordId) : undefined
              const locationName = attendance ? locationNameById.get(attendance.locationId) : undefined
              return (
                <li key={session.id} className="min-w-0 rounded-xl bg-[var(--surface-soft)] p-3.5">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{session.taskTitleSnapshot.trim() || '自由学习'}</span>
                    <Chip tone={session.mode === 'pomodoro' ? 'accent' : 'muted'}>{session.mode === 'pomodoro' ? '番茄专注' : '自由计时'}</Chip>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                    <span>{timeHm(session.startedAt)} – {session.endedAt ? timeHm(session.endedAt) : '进行中'}</span>
                    <span>学习 {formatDurationHuman(seconds)}</span>
                    {session.mode === 'pomodoro' && session.pomodoroCompletedRounds > 0 && <span>完成 {session.pomodoroCompletedRounds} 轮</span>}
                    {locationName && <span className="inline-flex items-center gap-1"><MapPin size={12} aria-hidden="true" />{locationName}</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="surface min-w-0 rounded-2xl p-5" aria-label="最近签到记录">
        <h2 className="flex items-center gap-2 font-bold"><MapPin size={18} className="text-[var(--accent-strong)]" />最近签到</h2>
        {!recentRecords.length ? (
          <p className="mt-4 text-sm text-[var(--muted)]">还没有签到记录。</p>
        ) : (
          <ul className="mt-4 grid gap-2.5">
            {recentRecords.map((record) => {
              const seconds = Math.max(0, Math.floor(((record.checkOutAt ? Date.parse(record.checkOutAt) : nowMs) - Date.parse(record.checkInAt)) / 1000))
              return (
                <li key={record.id} className="min-w-0 rounded-xl bg-[var(--surface-soft)] p-3.5">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{locationNameById.get(record.locationId) ?? '学习地点'}</span>
                    {record.manualClosed && <Chip tone="rose">异常结束</Chip>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                    <span>签到 {timeHm(record.checkInAt)}</span>
                    <span>{record.checkOutAt ? `签退 ${timeHm(record.checkOutAt)}` : '进行中'}</span>
                    <span>在场 {formatDurationHuman(seconds)}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function Chip({ tone, children }: { tone: 'accent' | 'rose' | 'muted'; children: ReactNode }) {
  const tones: Record<'accent' | 'rose' | 'muted', string> = {
    accent: 'bg-[var(--accent-soft)] text-[var(--accent-strong)]',
    rose: 'bg-[var(--rose-soft)] text-[var(--rose)]',
    muted: 'border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]',
  }
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>
}
