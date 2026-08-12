import { useState, type FormEvent } from 'react'
import { BookOpen, Plus } from 'lucide-react'
import { Button } from '../../components/Button'
import { Input } from '../../components/FormField'
import type { Task } from '../../types'
import { getErrorMessage } from '../../utils/errorMessage'
import { FIRST_TASK_TEMPLATES } from '../../utils/quickStart'

interface TaskStarterFormProps {
  onCreate: (title: string, estimatedMinutes: number) => Promise<Task>
  onCreated: (task: Task) => void
  submitLabel?: string
  autoFocus?: boolean
}

export function TaskStarterForm({ onCreate, onCreated, submitLabel = '创建任务', autoFocus = false }: TaskStarterFormProps) {
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState('30')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const choose = (template: (typeof FIRST_TASK_TEMPLATES)[number]) => {
    setTitle(template.title)
    setMinutes(String(template.estimatedMinutes))
    setError('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    const value = title.trim()
    const duration = Number(minutes)
    if (!value) return setError('请输入任务名称')
    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) return setError('预计时长需要在 1-1440 分钟之间')
    setBusy(true); setError('')
    try { onCreated(await onCreate(value, duration)) }
    catch (reason) { setError(getErrorMessage(reason, '创建任务失败')) }
    finally { setBusy(false) }
  }

  return (
    <form className="grid min-w-0 gap-4" onSubmit={submit} noValidate>
      <div>
        <p className="mb-2 text-sm font-semibold">快速选择</p>
        <div className="grid grid-cols-2 gap-2">
          {FIRST_TASK_TEMPLATES.map((template) => (
            <button
              key={template.title}
              type="button"
              onClick={() => choose(template)}
              className="focus-ring min-h-11 min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-left text-xs font-semibold leading-5 text-[var(--ink)] transition active:scale-[0.98] hover:bg-[var(--surface-soft)] sm:text-sm"
            >
              <span className="block truncate">{template.title}</span>
              <span className="block text-[11px] font-normal text-[var(--muted)]">{template.estimatedMinutes} 分钟</span>
            </button>
          ))}
        </div>
      </div>
      <Input label="任务名称" name="starter-task-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：复习英语阅读" maxLength={100} autoFocus={autoFocus} />
      <Input label="预计时长（分钟）" name="starter-task-minutes" type="number" inputMode="numeric" min={1} max={1440} value={minutes} onChange={(event) => setMinutes(event.target.value)} />
      {error && <p className="rounded-xl bg-[var(--rose-soft)] px-3 py-2 text-sm text-[var(--rose)]" role="alert">{error}</p>}
      <Button type="submit" className="w-full" loading={busy} icon={title ? <Plus size={17} /> : <BookOpen size={17} />}>{submitLabel}</Button>
    </form>
  )
}
