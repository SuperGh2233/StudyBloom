import { BarChart3, BookOpen, CalendarDays, LogOut, Settings, Sprout, Users } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { InstallPWA } from '../components/InstallPWA'
import { useToast } from '../components/ToastProvider'
import { useAuth } from '../features/auth/AuthContext'
import { ActiveStudyBar } from '../features/study/ActiveStudyBar'
import { StudySessionProvider } from '../hooks/useStudyMode'
import { CompanionDataProvider } from '../features/companionship/CompanionDataContext'
import { FriendshipsProvider } from '../features/friends/FriendshipsContext'

const items = [
  { to: '/calendar', label: '日历', icon: CalendarDays },
  { to: '/friends', label: '好友', icon: Users },
  { to: '/study', label: '学习', icon: BookOpen },
  { to: '/statistics', label: '统计', icon: BarChart3 },
  { to: '/settings', label: '设置', icon: Settings },
]

export function AppShell() {
  const { signOut } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      showToast('退出失败，请检查网络后重试', 'error')
    }
  }

  return (
    <div className="app-background min-h-[100dvh]">
      <StudySessionProvider>
        <CompanionDataProvider>
        <FriendshipsProvider>
        <header className="pwa-safe-top sticky top-0 z-30 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--page)_90%,transparent)] backdrop-blur-xl">
          <div className="pwa-safe-inline mx-auto flex h-16 max-w-7xl min-w-0 items-center justify-between gap-2">
            <NavLink to="/calendar" className="focus-ring flex min-w-0 items-center gap-2 rounded-xl" aria-label="StudyBloom 日历首页">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-strong)] text-white"><Sprout size={19} strokeWidth={1.9} /></span>
              <div className="min-w-0 leading-tight">
                <strong className="block truncate text-[15px] tracking-tight">StudyBloom</strong>
                <span className="hidden truncate text-[11px] text-[var(--muted)] sm:block">让每一天的努力，慢慢开花</span>
              </div>
            </NavLink>
            <nav className="hidden items-center gap-1 md:flex" aria-label="主导航">
              {items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `focus-ring flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${isActive ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'text-[var(--muted)] hover:bg-[var(--surface-soft)]'}`}><Icon size={18} strokeWidth={1.8} />{label}</NavLink>)}
            </nav>
            <button onClick={handleSignOut} className="focus-ring hidden h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--ink)] md:grid" aria-label="退出登录"><LogOut size={19} strokeWidth={1.8} /></button>
          </div>
        </header>

        <main className="pwa-safe-inline mx-auto w-full max-w-7xl pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5 md:pb-10 md:pt-8"><Outlet /></main>

        <ActiveStudyBar />

        <nav className="safe-bottom pwa-safe-inline fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] pt-2 backdrop-blur-xl md:hidden" aria-label="主导航">
          {items.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `focus-ring grid min-h-14 min-w-0 justify-items-center gap-1 rounded-xl py-1 text-xs font-semibold ${isActive ? 'text-[var(--accent-strong)]' : 'text-[var(--muted)]'}`}><Icon size={21} strokeWidth={1.8} /><span className="max-w-full min-w-0 truncate">{label}</span></NavLink>)}
        </nav>
        <InstallPWA />
        </FriendshipsProvider>
        </CompanionDataProvider>
      </StudySessionProvider>
    </div>
  )
}
