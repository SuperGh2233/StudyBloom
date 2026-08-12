import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingState } from '../../components/LoadingState'
import { useAuth } from './AuthContext'
import { inviteCodeFromSearch, readPendingInvite, rememberPendingInvite } from '../../utils/friendInvite'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  useEffect(() => {
    const code = inviteCodeFromSearch(location.search)
    if (code) rememberPendingInvite(code)
  }, [location.search])
  if (loading) return <main className="app-background min-h-[100dvh]"><LoadingState label="正在确认登录状态..." /></main>
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth()
  if (loading) return <main className="app-background min-h-[100dvh]"><LoadingState label="正在打开 StudyBloom..." /></main>
  const pendingInvite = readPendingInvite()
  return user ? <Navigate to={pendingInvite ? `/friends?invite=${encodeURIComponent(pendingInvite)}` : '/calendar'} replace /> : <Outlet />
}
