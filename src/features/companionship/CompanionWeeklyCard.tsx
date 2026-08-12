import { Flower2 } from 'lucide-react'
import type { useCompanionship } from '../../hooks/useCompanionship'

export function CompanionWeeklyCard({ data }: { data: ReturnType<typeof useCompanionship> }) {
  if (data.loading || !data.primaryId || !data.weekly) return null
  const { weekly } = data
  return (
    <section className="surface mt-5 rounded-2xl p-5 sm:p-6" aria-labelledby="companion-weekly-title">
      <h2 id="companion-weekly-title" className="flex items-center gap-2 font-bold"><Flower2 size={19} className="text-[var(--accent-strong)]" />你们的本周记录</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{weekly.summary}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="本周共同学习" value={`${weekly.weekBloomDays} 天`} />
        <Metric label="互相送花" value={`${weekly.weekMutualFlowerDays} 天`} />
        <Metric label="累计共同学习" value={`${weekly.totalBloomDays} 天`} className="col-span-2 sm:col-span-1" />
      </div>
      {weekly.milestone && <p className="mt-4 rounded-xl bg-[var(--accent-soft)] px-4 py-3 text-sm font-semibold text-[var(--accent-strong)]">你们已经共同积累了第 {weekly.milestone} 个学习日。</p>}
    </section>
  )
}

function Metric({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return <div className={`rounded-xl bg-[var(--surface-soft)] p-3 ${className}`}><p className="text-xs text-[var(--muted)]">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>
}

