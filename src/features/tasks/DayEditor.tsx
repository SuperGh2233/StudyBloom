import { addDays, format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ArrowDown, ArrowUp, CalendarPlus, ClipboardCopy, History, Moon, Plus, Save, Square, SquareCheck, Timer, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CopyMode, PlanDay, Task, TaskStudySummary, TaskUpdate } from '../../types'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Input, Textarea } from '../../components/FormField'
import { useToast } from '../../components/ToastProvider'
import { getErrorMessage } from '../../utils/errorMessage'
import { addDays as addDateKeyDays, todayDateKey } from '../../utils/date'
import { TaskStudyProgress } from './TaskStudyProgress'
import { TaskStudyDetail } from './TaskStudyDetail'

const ESTIMATE_PRESETS = [30, 45, 60, 90, 120]

interface DayEditorProps {
  open: boolean
  date: string
  tasks: Task[]
  planDay?: PlanDay
  onClose: () => void
  studySummaries: Map<string, TaskStudySummary>
  onAdd: (date: string, title: string, estimatedMinutes?: number | null) => Promise<unknown>
  onUpdate: (id: string, update: TaskUpdate) => Promise<void>
  onToggle: (id: string, completed: boolean) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onMove: (date: string, id: string, direction: -1 | 1) => Promise<void>
  onSavePlanDay: (date: string, update: { note?: string; isRestDay?: boolean }) => Promise<unknown>
  onCopy: (sourceDate: string, targetDate: string, mode: CopyMode) => Promise<void>
}

export function DayEditor(props: DayEditorProps) {
  const { open, date, tasks, planDay, onClose } = props
  const [newTask, setNewTask] = useState('')
  const [newEstimated, setNewEstimated] = useState('')
  const [note, setNote] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [copyMode, setCopyMode] = useState<CopyMode>('append')
  const [busy, setBusy] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const { showToast } = useToast()
  const navigate = useNavigate()
  const isToday = date === todayDateKey()
  const title = useMemo(() => format(parseISO(date), 'M月d日 EEEE', { locale: zhCN }), [date])

  useEffect(() => { setNote(planDay?.note ?? ''); setNewTask(''); setNewEstimated(''); setTargetDate('') }, [date, planDay?.note])
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = '' }
  }, [open, busy, onClose])
  useEffect(() => {
    if (!open || !window.visualViewport) return
    const viewport = window.visualViewport
    const updateKeyboardInset = () => {
      const visibleBottom = viewport.height + viewport.offsetTop
      const inset = Math.max(0, window.innerHeight - visibleBottom)
      document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`)
    }
    updateKeyboardInset()
    viewport.addEventListener('resize', updateKeyboardInset)
    viewport.addEventListener('scroll', updateKeyboardInset)
    return () => {
      viewport.removeEventListener('resize', updateKeyboardInset)
      viewport.removeEventListener('scroll', updateKeyboardInset)
      document.documentElement.style.removeProperty('--keyboard-inset')
    }
  }, [open])
  if (!open) return null

  const run = async (key: string, action: () => Promise<unknown>, success?: string) => {
    if (busy) return
    setBusy(key)
    try { await action(); if (success) showToast(success) }
    catch (error) { showToast(getErrorMessage(error), 'error') }
    finally { setBusy('') }
  }

  const addTask = (event: FormEvent) => {
    event.preventDefault()
    const value = newTask.trim()
    if (!value) return showToast('任务名称不能为空', 'error')
    const estimatedMinutes = newEstimated ? Number(newEstimated) : null
    if (estimatedMinutes !== null && (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 1 || estimatedMinutes > 1440)) return showToast('预计时长需要在 1–1440 分钟之间', 'error')
    void run('add', async () => { await props.onAdd(date, value, estimatedMinutes); setNewTask(''); setNewEstimated('') }, '任务已添加')
  }

  const copyPrevious = () => run('copy-previous', () => props.onCopy(addDateKeyDays(date, -1), date, 'append'), '已复制前一天的任务')
  const copyToTarget = () => {
    if (!targetDate) return showToast('请选择目标日期', 'error')
    if (targetDate === date) return showToast('目标日期不能与当前日期相同', 'error')
    void run('copy-target', () => props.onCopy(date, targetDate, copyMode), '任务已复制')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end overflow-x-hidden bg-[#17231dcc] md:items-center md:justify-center md:px-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <section className="surface drawer-enter safe-bottom pwa-keyboard-safe flex max-h-[85dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-2xl md:max-w-2xl md:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="day-editor-title">
        <header className="flex min-w-0 items-center gap-3 border-b border-[var(--line)] px-4 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 id="day-editor-title" className="truncate text-lg font-bold">{title}</h2>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{tasks.length ? `${tasks.filter((task) => task.completed).length}/${tasks.length} 项已完成` : '暂无任务'}</p>
          </div>
          <button className="focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--surface-soft)]" onClick={onClose} aria-label="关闭计划编辑"><X size={20} /></button>
        </header>

        <div className="min-h-0 min-w-0 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          <div className="mb-5 flex min-w-0 items-center justify-between gap-3 rounded-xl bg-[var(--surface-soft)] p-3">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold"><Moon size={18} className="shrink-0 text-[var(--rose)]" />设为休息日</div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(planDay?.isRestDay)}
              className={`focus-ring relative h-8 w-14 shrink-0 rounded-full transition ${planDay?.isRestDay ? 'bg-[var(--accent-strong)]' : 'bg-[var(--line)]'}`}
              onClick={() => run('rest', () => props.onSavePlanDay(date, { isRestDay: !planDay?.isRestDay }), planDay?.isRestDay ? '已取消休息日' : '已设为休息日')}
              disabled={Boolean(busy)}
            ><span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${planDay?.isRestDay ? 'left-7' : 'left-1'}`} /></button>
          </div>
          {planDay?.isRestDay && tasks.length > 0 && <p className="mb-4 rounded-xl bg-[var(--rose-soft)] px-4 py-3 text-sm leading-6 text-[var(--rose)]">休息日也可以保留轻量计划，记得给自己留出休息时间。</p>}

          <form className="mb-5 grid min-w-0 gap-3 rounded-xl bg-[var(--surface-soft)] p-3" onSubmit={addTask}>
            <Input label="新增任务" name="new-task" value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder="例如：复习英语单词" maxLength={100} />
            <div className="grid min-w-0 gap-2">
              <div className="flex min-w-0 items-end gap-2">
                <div className="min-w-0 flex-1"><Input label="预计学习时长（可选）" name="new-task-estimate" type="number" inputMode="numeric" min={1} max={1440} value={newEstimated} onChange={(event) => setNewEstimated(event.target.value)} placeholder="分钟" /></div>
                <Button className="shrink-0" type="submit" loading={busy === 'add'} icon={<Plus size={18} />}>添加</Button>
              </div>
              <div className="flex min-w-0 flex-wrap gap-1.5" aria-label="预计时长快捷选项">
                {ESTIMATE_PRESETS.map((minutes) => <button key={minutes} type="button" className={`focus-ring min-h-9 rounded-lg px-2.5 text-xs font-semibold ${newEstimated === String(minutes) ? 'bg-[var(--accent-strong)] text-white' : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'}`} onClick={() => setNewEstimated(String(minutes))}>{minutes} 分钟</button>)}
                {newEstimated && <button type="button" className="focus-ring min-h-9 rounded-lg px-2.5 text-xs text-[var(--muted)]" onClick={() => setNewEstimated('')}>不设置</button>}
              </div>
            </div>
          </form>

          <div className="grid min-w-0 gap-2" aria-label="当天任务">
            {tasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-sm text-[var(--muted)]">今天还没有任务，写下一件准备完成的小事吧。</div>
            ) : tasks.map((task, index) => (
              <div key={task.id} className="min-w-0 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2">
                <div className="flex min-w-0 items-center gap-2">
                  <button className={`focus-ring grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition ${task.completed ? 'border-[var(--accent-strong)] bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'border-[var(--line)] text-[var(--muted)]'}`} onClick={() => run(`toggle-${task.id}`, () => props.onToggle(task.id, !task.completed))} aria-pressed={task.completed} aria-label={task.completed ? `取消完成 ${task.title}` : `完成 ${task.title}`}>{task.completed ? <SquareCheck size={20} strokeWidth={2.5} /> : <Square size={20} strokeWidth={1.8} />}</button>
                  <input
                    className={`focus-ring min-w-0 flex-1 rounded-lg bg-transparent px-1 py-2 text-base sm:px-2 sm:text-sm ${task.completed ? 'text-[var(--muted)] line-through' : ''}`}
                    defaultValue={task.title}
                    maxLength={100}
                    aria-label="任务名称"
                    onBlur={(event) => { const value = event.target.value.trim(); if (value && value !== task.title) void run(`edit-${task.id}`, () => props.onUpdate(task.id, { title: value }), '任务已更新'); else event.target.value = task.title }}
                  />
                  <div className="flex shrink-0">
                    {isToday && <button className="focus-ring grid h-10 w-8 place-items-center rounded-lg text-[var(--accent-strong)] sm:w-9" onClick={() => navigate(`/study?task=${task.id}`)} aria-label={`开始学习 ${task.title}`}><Timer size={17} /></button>}
                    <button className="focus-ring grid h-10 w-8 place-items-center rounded-lg text-[var(--muted)] disabled:opacity-25 sm:w-9" disabled={index === 0 || Boolean(busy)} onClick={() => run(`move-${task.id}`, () => props.onMove(date, task.id, -1))} aria-label="上移任务"><ArrowUp size={17} /></button>
                    <button className="focus-ring grid h-10 w-8 place-items-center rounded-lg text-[var(--muted)] disabled:opacity-25 sm:w-9" disabled={index === tasks.length - 1 || Boolean(busy)} onClick={() => run(`move-${task.id}`, () => props.onMove(date, task.id, 1))} aria-label="下移任务"><ArrowDown size={17} /></button>
                    <button className="focus-ring grid h-10 w-8 place-items-center rounded-lg text-[var(--rose)] sm:w-9" onClick={() => setDeleteId(task.id)} aria-label={`删除 ${task.title}`}><Trash2 size={17} /></button>
                  </div>
                </div>
                <div className="mt-1 grid min-w-0 gap-2 pl-[52px] sm:grid-cols-[140px_minmax(0,1fr)_auto] sm:items-end">
                  <label className="grid gap-1 text-[11px] font-medium text-[var(--muted)]">预计分钟
                    <input type="number" inputMode="numeric" min={1} max={1440} defaultValue={task.estimatedMinutes ?? ''} placeholder="未设置" className="focus-ring h-9 min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface-soft)] px-2.5 text-base text-[var(--ink)] sm:text-sm" onBlur={(event) => { const raw = event.target.value.trim(); const next = raw ? Number(raw) : null; if (next !== null && (!Number.isInteger(next) || next < 1 || next > 1440)) { event.target.value = task.estimatedMinutes ? String(task.estimatedMinutes) : ''; showToast('预计时长需要在 1–1440 分钟之间', 'error'); return } if (next !== task.estimatedMinutes) void run(`estimate-${task.id}`, () => props.onUpdate(task.id, { estimatedMinutes: next }), '预计时长已更新') }} />
                  </label>
                  <TaskStudyProgress task={task} summary={props.studySummaries.get(task.id)} />
                  <button type="button" className="focus-ring flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] px-2.5 text-xs font-semibold text-[var(--muted)]" onClick={() => setDetailTask(task)}><History size={15} />学习详情</button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3">
            <Textarea label="当天备注" value={note} onChange={(event) => setNote(event.target.value)} placeholder="记录今天的重点、心情或需要调整的地方" maxLength={1000} hint={`${note.length}/1000`} />
            <div className="pwa-sticky-footer sticky bottom-0 z-10 -mx-4 border-t border-[var(--line)] bg-[var(--surface)] px-4 pt-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0">
              <Button variant="secondary" className="w-full sm:w-auto sm:justify-self-end" loading={busy === 'note'} icon={<Save size={17} />} onClick={() => run('note', () => props.onSavePlanDay(date, { note }), '备注已保存')}>保存备注</Button>
            </div>
          </div>

          <div className="mt-7 border-t border-[var(--line)] pt-5">
            <h3 className="font-bold">复制计划</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Button variant="secondary" loading={busy === 'copy-previous'} icon={<ClipboardCopy size={17} />} onClick={copyPrevious}>复制前一天</Button>
              <div className="grid gap-3 rounded-xl bg-[var(--surface-soft)] p-3 sm:col-span-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                <Input label="目标日期" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} min={format(addDays(new Date(), -3650), 'yyyy-MM-dd')} />
                <label className="grid gap-2 text-sm font-medium">复制方式<select className="focus-ring min-h-12 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3" value={copyMode} onChange={(event) => setCopyMode(event.target.value as CopyMode)}><option value="append">追加</option><option value="overwrite">覆盖</option></select></label>
                <Button loading={busy === 'copy-target'} icon={<CalendarPlus size={17} />} onClick={copyToTarget}>复制</Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ConfirmDialog open={Boolean(deleteId)} title="删除这项任务？" description="删除后无法恢复，请确认是否继续。" confirmLabel="删除" danger loading={busy === 'delete'} onClose={() => setDeleteId(null)} onConfirm={() => { if (!deleteId) return; void run('delete', async () => { await props.onDelete(deleteId); setDeleteId(null) }, '任务已删除') }} />
      <TaskStudyDetail task={detailTask} onClose={() => setDetailTask(null)} />
    </div>
  )
}
