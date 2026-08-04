import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import * as authService from '../../services/auth'
import { requestPasswordReset as sendReset, updatePassword as savePassword } from '../../services/authRecovery'
import type { User } from '../../types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  configured: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mapUser(user: SupabaseUser | null): User | null {
  return user ? { id: user.id, email: user.email, displayName: typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : undefined } : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    let active = true
    authService.getSession()
      .then((session) => { if (active) setUser(mapUser(session?.user ?? null)) })
      .catch(() => { if (active) setUser(null) })
      .finally(() => { if (active) setLoading(false) })
    const subscription = authService.onAuthStateChange((_event, session) => setUser(mapUser(session?.user ?? null)))
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => { const result = await authService.signIn(email, password); setUser(result.user) }, [])
  const signUp = useCallback(async (email: string, password: string) => { const result = await authService.signUp(email, password); setUser(result.user); return Boolean(result.session) }, [])
  const signOut = useCallback(async () => { await authService.signOut(); setUser(null) }, [])
  const requestPasswordReset = useCallback(async (email: string) => { await sendReset(email, `${window.location.origin}/reset-password`) }, [])
  const updatePassword = useCallback(async (password: string) => { await savePassword(password) }, [])
  const value = useMemo(() => ({ user, loading, configured: Boolean(supabase), signIn, signUp, signOut, requestPasswordReset, updatePassword }), [user, loading, signIn, signUp, signOut, requestPasswordReset, updatePassword])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return value
}
