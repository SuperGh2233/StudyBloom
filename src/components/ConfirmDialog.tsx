import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  loading?: boolean
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({ open, title, description, confirmLabel = '确认', loading, danger = false, onConfirm, onClose }: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !loading) onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, loading, onClose])
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#17231dcc] px-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose() }}>
      <section className="surface gentle-enter w-full max-w-sm rounded-2xl p-5" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--rose-soft)] text-[var(--rose)]"><AlertTriangle size={20} /></span>
          <div className="flex-1">
            <h2 id="confirm-title" className="font-bold">{title}</h2>
            <p id="confirm-description" className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
          </div>
          <button className="focus-ring grid h-10 w-10 place-items-center rounded-xl text-[var(--muted)]" onClick={onClose} aria-label="关闭" disabled={loading}><X size={19} /></button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>取消</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </div>
      </section>
    </div>
  )
}
