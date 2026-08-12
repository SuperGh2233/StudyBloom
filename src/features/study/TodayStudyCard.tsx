import { useState } from 'react'
import { CheckCircle2, ChevronRight, Clock3, Pause, Play, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import type { StudyMode, StudySession, StudySessionSegment, Task } from '../../types'
import { formatClockHMS, formatClockMS, formatDurationHuman, phaseRemainingSeconds, sessionElapsedSeconds } from '../../utils/studyDuration'
import { selectQuickStartTask } from '../../utils/quickStart'
import { TaskStarterForm } from './TaskStarterForm'

interface TodayStudyCardProps {
  tasks: Task[]
  tasksLoading: boolean
  session: StudySession | null
  segments: StudySessionSegment[]
  nowMs: number
  studiedSeconds: number
  busy: boolean
  onCreateTask: (title: string, estimatedMinutes: number) => Promise<Task>
  onStart: (taskId: string | null, mode?: StudyMode) => Promise<boolean>
}

export function TodayStudyCard(props: TodayStudyCardProps) {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const nextTask = selectQuickStartTask(props.tasks)
  const allDone = props.tasks.length > 0 && !nextTask

  if (props.session) {
    const paused = props.session.status === 'paused'
    const waiting = props.session.status === 'waiting'
    const value = props.session.mode === 'pomodoro'
      ? waiting ? '本轮已完成' : formatClockMS(phaseRemainingSeconds(props.session, props.nowMs))
      : formatClockHMS(sessionElapsedSeconds(props.session, props.segments, props.nowMs))
    return (
      <section className="surface min-w-0 rounded-2xl p-4 sm:p-5" aria-label="今日学习">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-strong)] text-white">{paused ? <Pause size={19} /> : <Play size={19} />}</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--accent-strong)]">{paused ? '学习已暂停' : waiting ? '等待下一步' : '正在学习'}</p>
            <h2 className="mt-0.5 truncate text-lg font-bold">{props.session.taskTitleSnapshot.trim() || '自由学习'}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{props.session.mode === 'pomodoro' ? '番茄专注' : '自由计时'}，{value}</p>
          </div>
        </div>
        <Button className="mt-4 w-full" loading={props.busy} icon={<ChevronRight size={18} />} onClick={() => void props.onStart(props.session?.taskId ?? null)}>{paused ? '继续学习' : '查看学习进度'}</Button>
      </section>
    )
  }

  if (props.tasksLoading) {
    return <section className="surface min-h-32 animate-pulse rounded-2xl p-5" aria-label="正在读取今日学习"><div className="h-4 w-24 rounded bg-[var(--surface-soft)]" /><div className="mt-3 h-7 w-2/3 rounded bg-[var(--surface-soft)]" /><div className="mt-5 h-11 rounded-xl bg-[var(--surface-soft)]" /></section>
  }

  if (nextTask) {
    return (
      <section className="surface min-w-0 rounded-2xl p-4 sm:p-5" aria-label="今日学习">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Clock3 size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--accent-strong)]">接下来学什么</p>
            <h2 className="mt-0.5 line-clamp-2 break-words text-lg font-bold">{nextTask.title}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">预计 {nextTask.estimatedMinutes ? `${nextTask.estimatedMinutes} 分钟` : '未设置'}，今日已学习 {formatDurationHuman(props.studiedSeconds)}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Button className="min-w-0" loading={props.busy} icon={<Play size={17} />} onClick={() => void props.onStart(nextTask.id)}>开始学习</Button>
          <Button variant="secondary" className="px-3" disabled={props.busy} onClick={() => navigate(`/study?task=${nextTask.id}`)}>更换任务</Button>
        </div>
      </section>
    )
  }

  if (allDone) {
    return (
      <section className="surface gentle-enter min-w-0 rounded-2xl p-4 ring-1 ring-[var(--accent)] sm:p-5" aria-label="今日任务已完成">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-strong)] text-white"><Sparkles size={20} /></span>
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[var(--accent-strong)]">今天的计划完成啦</p><h2 className="mt-0.5 text-lg font-bold">完成 {props.tasks.length} 项任务</h2><p className="mt-1 text-sm text-[var(--muted)]">今天共学习 {formatDurationHuman(props.studiedSeconds)}，辛苦了。</p></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2"><Button icon={<CheckCircle2 size={17} />} onClick={() => navigate('/statistics')}>看看成果</Button><Button variant="secondary" loading={props.busy} onClick={() => void props.onStart(null, 'free')}>再学一会儿</Button></div>
      </section>
    )
  }

  return (
    <section className="surface min-w-0 rounded-2xl p-4 sm:p-5" aria-label="创建今日任务">
      <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Play size={19} /></span><div><p className="text-xs font-semibold text-[var(--accent-strong)]">今日学习</p><h2 className="mt-0.5 text-lg font-bold">写下今天最重要的一件事</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">先完成一件小事，再慢慢增加。</p></div></div>
      {creating ? <div className="mt-4"><TaskStarterForm autoFocus onCreate={props.onCreateTask} onCreated={() => setCreating(false)} /><button type="button" className="focus-ring mt-2 min-h-11 w-full rounded-xl text-sm font-semibold text-[var(--muted)]" onClick={() => setCreating(false)}>取消</button></div> : <Button className="mt-4 w-full" onClick={() => setCreating(true)}>创建第一项任务</Button>}
    </section>
  )
}
