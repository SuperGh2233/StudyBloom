import { Home, Sprout } from 'lucide-react'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="app-background grid min-h-[100dvh] place-items-center px-5">
      <section className="max-w-md text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]"><Sprout size={28} /></span>
        <p className="mt-6 text-sm font-semibold text-[var(--accent-strong)]">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">这一天还没有种下计划</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">你访问的页面不存在，回到日历继续安排今天吧。</p>
        <Link to="/calendar" className="focus-ring mx-auto mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-5 py-3 text-sm font-semibold text-white"><Home size={18} />返回日历</Link>
      </section>
    </main>
  )
}
