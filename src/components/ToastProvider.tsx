import { CheckCircle2, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type ToastKind = 'success' | 'error'
interface Toast { id: number; message: string; kind: ToastKind }
interface ToastContextValue { showToast: (message: string, kind?: ToastKind) => void }

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = useCallback((id: number) => setToasts((items) => items.filter((item) => item.id !== id)), [])
  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((items) => [...items.slice(-2), { id, message, kind }])
    window.setTimeout(() => dismiss(id), 3600)
  }, [dismiss])
  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-[70] grid justify-items-center gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="surface gentle-enter pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium">
            {toast.kind === 'success' ? <CheckCircle2 className="shrink-0 text-[var(--accent-strong)]" size={20} /> : <XCircle className="shrink-0 text-[#b84d56]" size={20} />}
            <span className="flex-1">{toast.message}</span>
            <button className="focus-ring grid h-9 w-9 place-items-center rounded-lg text-[var(--muted)]" aria-label="关闭提示" onClick={() => dismiss(toast.id)}><X size={18} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast 必须在 ToastProvider 内使用')
  return value
}
