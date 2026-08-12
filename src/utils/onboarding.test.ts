import { beforeEach, describe, expect, it } from 'vitest'
import { chooseProgressivePrompt, isFirstRunCandidate, readOnboardingState, saveOnboardingState, snoozeProgressivePrompt } from './onboarding'

describe('onboarding state', () => {
  beforeEach(() => localStorage.clear())

  it('only treats an empty account without a stored decision as new', () => {
    expect(isFirstRunCandidate({ hasTasks: false, hasStudySessions: false, storedState: null })).toBe(true)
    expect(isFirstRunCandidate({ hasTasks: true, hasStudySessions: false, storedState: null })).toBe(false)
    expect(isFirstRunCandidate({ hasTasks: false, hasStudySessions: true, storedState: null })).toBe(false)
  })

  it('keeps a dismissed guide from reopening', () => {
    saveOnboardingState('u1', 'dismissed')
    expect(readOnboardingState('u1')).toBe('dismissed')
    expect(isFirstRunCandidate({ hasTasks: false, hasStudySessions: false, storedState: readOnboardingState('u1') })).toBe(false)
  })

  it('shows one progressive prompt and snoozes it for seven days', () => {
    const input = { userId: 'u1', studiedSeconds: 900, dailyGoalEnabled: false, activeStudyDays: 3, hasStudyLocation: false, allTodayTasksCompleted: true, now: 1000, storage: localStorage }
    expect(chooseProgressivePrompt(input)).toBe('goal')
    snoozeProgressivePrompt('u1', 'goal', 1000, localStorage)
    expect(chooseProgressivePrompt(input)).toBe('location')
  })
})
