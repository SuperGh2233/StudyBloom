import { useEffect, useState } from 'react'
import { MapPin, Target, Users, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { listMyStudyLocations } from '../../services/attendance'
import { chooseProgressivePrompt, snoozeProgressivePrompt, type ProgressivePromptKind } from '../../utils/onboarding'

interface ProgressivePromptProps {
  hidden?: boolean
  studiedSeconds: number
  dailyGoalEnabled: boolean
  activeStudyDays: number
  allTodayTasksCompleted: boolean
}

const content: Record<ProgressivePromptKind, { title: string; description: string; action: string; to: string; icon: typeof Target }> = {
  goal: { title: '给每天定一个温柔的目标', description: '设置每日学习分钟数，让进步更清晰。', action: '设置目标', to: '/settings#daily-goal', icon: Target },
  location: { title: '记录每一次到馆学习', description: '设置常去的学习地点，签到只在你主动操作时获取位置。', action: '设置地点', to: '/settings#study-locations', icon: MapPin },
  friend: { title: '邀请一位学习搭子', description: '让重要的人看见你的坚持，日历仍需单独授权。', action: '邀请搭子', to: '/friends', icon: Users },
}

export function ProgressivePrompt(props: ProgressivePromptProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [hasLocation, setHasLocation] = useState<boolean | null>(props.activeStudyDays >= 3 ? null : true)
  const [dismissed, setDismissed] = useState<ProgressivePromptKind | null>(null)

  useEffect(() => {
    let active = true
    if (props.activeStudyDays < 3) { setHasLocation(true); return }
    listMyStudyLocations()
      .then((locations) => { if (active) setHasLocation(locations.some((location) => location.isActive)) })
      .catch(() => { if (active) setHasLocation(null) })
    return () => { active = false }
  }, [props.activeStudyDays])

  const candidate = user ? chooseProgressivePrompt({
    userId: user.id,
    studiedSeconds: props.studiedSeconds,
    dailyGoalEnabled: props.dailyGoalEnabled,
    activeStudyDays: props.activeStudyDays,
    hasStudyLocation: hasLocation,
    allTodayTasksCompleted: props.allTodayTasksCompleted,
  }) : null
  const kind = candidate === dismissed ? null : candidate

  if (props.hidden || !user || !kind) return null
  const item = content[kind]
  const Icon = item.icon
  const dismiss = () => { snoozeProgressivePrompt(user.id, kind); setDismissed(kind) }

  return (
    <aside className="mt-3 flex min-w-0 items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4" aria-label="功能建议">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Icon size={19} /></span>
      <div className="min-w-0 flex-1"><h2 className="text-sm font-bold">{item.title}</h2><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.description}</p><button type="button" className="focus-ring mt-2 min-h-11 rounded-xl pr-3 text-sm font-semibold text-[var(--accent-strong)]" onClick={() => navigate(item.to)}>{item.action}</button></div>
      <button type="button" className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--muted)]" onClick={dismiss} aria-label="七天内不再提醒"><X size={18} /></button>
    </aside>
  )
}
