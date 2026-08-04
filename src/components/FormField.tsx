import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface BaseProps {
  label: string
  error?: string
  hint?: string
}

type InputProps = BaseProps & InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, hint, className = '', id, ...props }, ref) {
  const inputId = id ?? props.name
  const helpId = inputId ? `${inputId}-help` : undefined
  return (
    <label className="grid gap-2 text-sm font-medium text-[var(--ink)]" htmlFor={inputId}>
      {label}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={helpId}
        className={`focus-ring min-h-12 w-full rounded-xl border bg-[var(--surface)] px-3.5 text-base text-[var(--ink)] placeholder:text-[var(--muted)] ${error ? 'border-[#b84d56]' : 'border-[var(--line)]'} ${className}`}
        {...props}
      />
      {(error || hint) && <span id={helpId} className={`text-xs ${error ? 'text-[#b84d56]' : 'text-[var(--muted)]'}`}>{error ?? hint}</span>}
    </label>
  )
})

type TextareaProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, error, hint, className = '', id, ...props }, ref) {
  const inputId = id ?? props.name
  const helpId = inputId ? `${inputId}-help` : undefined
  return (
    <label className="grid gap-2 text-sm font-medium text-[var(--ink)]" htmlFor={inputId}>
      {label}
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={helpId}
        className={`focus-ring min-h-28 w-full resize-y rounded-xl border bg-[var(--surface)] px-3.5 py-3 text-base text-[var(--ink)] placeholder:text-[var(--muted)] ${error ? 'border-[#b84d56]' : 'border-[var(--line)]'} ${className}`}
        {...props}
      />
      {(error || hint) && <span id={helpId} className={`text-xs ${error ? 'text-[#b84d56]' : 'text-[var(--muted)]'}`}>{error ?? hint}</span>}
    </label>
  )
})
