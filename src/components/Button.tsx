import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
  icon?: ReactNode
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-[linear-gradient(160deg,var(--accent)_0%,var(--accent-strong)_60%)] text-white shadow-[0_1px_2px_rgba(36,51,43,0.2),0_6px_16px_-6px_var(--accent-strong)] hover:brightness-105',
  secondary: 'border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-sm)] hover:bg-[var(--surface-soft)]',
  ghost: 'text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink)]',
  danger: 'bg-[#a84f58] text-white shadow-[0_1px_2px_rgba(36,51,43,0.2)] hover:bg-[#943f48]',
}

export function Button({ className = '', variant = 'primary', loading, icon, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-200 active:scale-[0.98] disabled:opacity-55 ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}
