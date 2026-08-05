import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoadingState } from './components/LoadingState'
import { OfflineBanner } from './components/OfflineBanner'
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt'
import { AppShell } from './layouts/AppShell'
import { ProtectedRoute, PublicOnlyRoute } from './features/auth/RouteGuards'

const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })))
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((module) => ({ default: module.CalendarPage })))
const FriendCalendarPage = lazy(() => import('./pages/FriendCalendarPage').then((module) => ({ default: module.FriendCalendarPage })))
const FriendsPage = lazy(() => import('./pages/FriendsPage').then((module) => ({ default: module.FriendsPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })))
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const StatisticsPage = lazy(() => import('./pages/StatisticsPage').then((module) => ({ default: module.StatisticsPage })))

export default function App() {
  return (
    <>
      <Suspense fallback={<main className="app-background min-h-[100dvh]"><LoadingState label="正在打开页面..." /></main>}>
        <Routes>
          <Route element={<PublicOnlyRoute />}><Route path="/login" element={<AuthPage />} /></Route>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/calendar" replace />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/friends" element={<FriendsPage />} />
              <Route path="/friends/:id" element={<FriendCalendarPage />} />
              <Route path="/statistics" element={<StatisticsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      <OfflineBanner />
      <PWAUpdatePrompt />
    </>
  )
}
