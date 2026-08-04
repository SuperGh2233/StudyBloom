import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingState } from '../../components/LoadingState'
import { useAuth } from './AuthContext'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <main className="app-background min-h-[100dvh]"><LoadingState label="正在确认登录状态..." /></main>
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth()
  if (loading) return <main className="app-background min-h-[100dvh]"><LoadingState label="正在打开 StudyBloom..." /></main>
  return user ? <Navigate to="/calendar" replace /> : <Outlet />
}
