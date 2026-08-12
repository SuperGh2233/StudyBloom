import { describe, expect, it } from 'vitest'
import type { StudyPreferences, Task } from '../types'
import { buildQuickStartInput, selectQuickStartTask } from './quickStart'

const task = (id: string, completed: boolean, sortOrder: number): Task => ({
  id, completed, sortOrder, userId: 'u1', planDate: '2026-08-12', title: id,
  estimatedMinutes: 30, createdAt: `2026-08-12T00:00:0${sortOrder}Z`, updatedAt: '',
})

describe('quick start', () => {
  it('selects the first unfinished task in task order', () => {
    expect(selectQuickStartTask([task('done', true, 0), task('later', false, 2), task('first', false, 1)])?.id).toBe('first')
  })

  it('uses a 25/5 pomodoro when no preference exists', () => {
    expect(buildQuickStartInput('task-1', null)).toMatchObject({
      mode: 'pomodoro', taskId: 'task-1', focusSeconds: 1500, shortBreakSeconds: 300,
    })
  })

  it('restores the saved mode and settings', () => {
    const preferences = { defaultMode: 'free', focusSeconds: 3000 } as StudyPreferences
    expect(buildQuickStartInput('task-1', preferences)).toEqual({ mode: 'free', taskId: 'task-1' })
    expect(buildQuickStartInput('task-1', preferences, 'pomodoro')).toMatchObject({ mode: 'pomodoro', focusSeconds: 3000 })
  })
})
