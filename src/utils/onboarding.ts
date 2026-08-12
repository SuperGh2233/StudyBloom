export type OnboardingState = 'dismissed' | 'completed'
export type ProgressivePromptKind = 'goal' | 'location' | 'friend'

const ONBOARDING_VERSION = 'v1'
const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

const onboardingKey = (userId: string) => `studybloom:onboarding:${ONBOARDING_VERSION}:${userId}`
const promptKey = (userId: string, kind: ProgressivePromptKind) => `studybloom:prompt:${kind}:${userId}`

function localStore(): Storage | null {
  try { return window.localStorage } catch { return null }
}

export function readOnboardingState(userId: string, storage = localStore()): OnboardingState | null {
  if (!storage || !userId) return null
  try {
    const value = storage.getItem(onboardingKey(userId))
    return value === 'dismissed' || value === 'completed' ? value : null
  } catch { return null }
}

export function saveOnboardingState(userId: string, state: OnboardingState, storage = localStore()): void {
  if (!storage || !userId) return
  try { storage.setItem(onboardingKey(userId), state) } catch { /* 禁用本地存储时仍可继续使用 */ }
}

export function isFirstRunCandidate(input: { hasTasks: boolean; hasStudySessions: boolean; storedState: OnboardingState | null }): boolean {
  return !input.hasTasks && !input.hasStudySessions && input.storedState === null
}

export function snoozeProgressivePrompt(userId: string, kind: ProgressivePromptKind, now = Date.now(), storage = localStore()): void {
  if (!storage || !userId) return
  try { storage.setItem(promptKey(userId, kind), String(now + PROMPT_COOLDOWN_MS)) } catch { /* 无存储时不阻塞主流程 */ }
}

export function isProgressivePromptSnoozed(userId: string, kind: ProgressivePromptKind, now = Date.now(), storage = localStore()): boolean {
  if (!storage || !userId) return false
  try {
    const until = Number(storage.getItem(promptKey(userId, kind)))
    return Number.isFinite(until) && until > now
  } catch { return false }
}

export function chooseProgressivePrompt(input: {
  userId: string
  studiedSeconds: number
  dailyGoalEnabled: boolean
  activeStudyDays: number
  hasStudyLocation: boolean | null
  allTodayTasksCompleted: boolean
  now?: number
  storage?: Storage | null
}): ProgressivePromptKind | null {
  const now = input.now ?? Date.now()
  const storage = input.storage === undefined ? localStore() : input.storage
  if (input.studiedSeconds >= 10 * 60 && !input.dailyGoalEnabled && !isProgressivePromptSnoozed(input.userId, 'goal', now, storage)) return 'goal'
  if (input.activeStudyDays >= 3 && input.hasStudyLocation === false && !isProgressivePromptSnoozed(input.userId, 'location', now, storage)) return 'location'
  if (input.allTodayTasksCompleted && !isProgressivePromptSnoozed(input.userId, 'friend', now, storage)) return 'friend'
  return null
}
