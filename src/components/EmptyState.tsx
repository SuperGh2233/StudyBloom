import { Sprout } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="grid justify-items-center gap-3 px-5 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Sprout size={25} strokeWidth={1.8} /></span>
      <div>
        <h3 className="text-base font-semibold text-[var(--ink)]">{title}</h3>
        <p className="mt-1 max-w-sm text-sm leading-6 text-[var(--muted)]">{description}</p>
      </div>
      {action}
    </div>
  )
}
