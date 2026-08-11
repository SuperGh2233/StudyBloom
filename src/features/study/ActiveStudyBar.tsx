import { useNavigate } from 'react-router-dom'
import { useStudyMode } from '../../hooks/useStudyMode'
import { activeSessionSummary } from '../../utils/studyDuration'

/** Global floating pill pointing back to /study while a session is live. */
export function ActiveStudyBar() {
  const { session, segments, nowMs } = useStudyMode()
  const navigate = useNavigate()
  if (!session || session.endedAt) return null
  const { title, detail, clock } = activeSessionSummary(session, segments, nowMs)
  const label = `${title ? `${title} · ${detail}` : detail} · ${clock}`
  const go = () => navigate('/study')
  const inner = (
    <>
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--accent-strong)]" aria-hidden="true" />
      <span className="min-w-0 truncate">{label}</span>
    </>
  )
  return (
    <>
      <div className="pwa-safe-inline fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 md:hidden">
        <button
          type="button"
          onClick={go}
          aria-label="返回学习页面"
          className="focus-ring surface flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-[var(--ink)]"
        >
          {inner}
        </button>
      </div>
      <button
        type="button"
        onClick={go}
        aria-label="返回学习页面"
        className="focus-ring surface fixed bottom-6 right-6 z-20 hidden min-h-11 max-w-[22rem] items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-[var(--ink)] md:flex"
      >
        {inner}
      </button>
    </>
  )
}
