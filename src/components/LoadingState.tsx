export function LoadingState({ label = '正在加载...' }: { label?: string }) {
  return (
    <div className="grid min-h-48 place-items-center" role="status" aria-live="polite">
      <div className="grid justify-items-center gap-3 text-sm text-[var(--muted)]">
        <div className="flex gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((item) => <span key={item} className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--accent)]" style={{ animationDelay: `${item * 120}ms` }} />)}
        </div>
        {label}
      </div>
    </div>
  )
}
