import { useEffect, useState } from 'react'
import { useAuth } from '../features/auth/AuthContext'
import { hasAnyStudySession } from '../services/studySessions'
import { hasAnyTask } from '../services/tasks'
import { isFirstRunCandidate, readOnboardingState, saveOnboardingState } from '../utils/onboarding'

export function useFirstRunOnboarding() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true
    if (!user) { setLoading(false); setOpen(false); return }
    const storedState = readOnboardingState(user.id)
    if (storedState) { setLoading(false); setOpen(false); return }
    Promise.all([hasAnyTask(), hasAnyStudySession()])
      .then(([hasTasks, hasStudySessions]) => {
        if (active) setOpen(isFirstRunCandidate({ hasTasks, hasStudySessions, storedState }))
      })
      .catch(() => { if (active) setOpen(false) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user])

  const close = (state: 'dismissed' | 'completed') => {
    if (user) saveOnboardingState(user.id, state)
    setOpen(false)
  }

  return { loading, open, dismiss: () => close('dismissed'), complete: () => close('completed') }
}
