import { describe, expect, it } from 'vitest'
import { validateImportData } from './backup'

const TASK_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const LOCATION_ID = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e'
const ATTENDANCE_ID = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f'
const SESSION_ID = '3d4e5f6a-7b8c-4d9e-8f0a-2b3c4d5e6f7a'
const SEGMENT_ID = '4e5f6a7b-8c9d-4e0f-8a1b-3c4d5e6f7a8b'

const validV2 = {
  version: 2,
  exportedAt: '2026-08-11T00:00:00Z',
  tasks: [{ id: TASK_ID, planDate: '2026-08-10', title: '背单词', completed: false, sortOrder: 0 }],
  planDays: [{ planDate: '2026-08-10', isRestDay: false, note: '' }],
  studyLocations: [{ id: LOCATION_ID, name: '图书馆', latitude: 31.23, longitude: 121.47, radiusM: 200, isActive: true, isDefault: true }],
  attendanceRecords: [{
    id: ATTENDANCE_ID,
    locationId: LOCATION_ID,
    checkInAt: '2026-08-10T09:00:00+08:00',
    checkInLatitude: 31.2301,
    checkInLongitude: 121.4738,
    checkInAccuracyM: 20,
    checkInDistanceM: 15,
    checkOutAt: '2026-08-10T11:00:00+08:00',
    checkOutLatitude: 31.2302,
    checkOutLongitude: 121.4739,
    checkOutAccuracyM: 18,
    checkOutDistanceM: 12,
    manualClosed: false,
  }],
  studySessions: [{
    id: SESSION_ID,
    taskId: TASK_ID,
    taskTitleSnapshot: '背单词',
    attendanceRecordId: ATTENDANCE_ID,
    planDate: '2026-08-10',
    mode: 'free',
    status: 'completed',
    startedAt: '2026-08-10T09:05:00+08:00',
    endedAt: '2026-08-10T09:53:00+08:00',
    pomodoroFocusSeconds: null,
    pomodoroShortBreakSeconds: null,
    pomodoroLongBreakSeconds: null,
    pomodoroRoundsBeforeLongBreak: null,
    pomodoroCompletedRounds: 0,
    currentPhase: null,
    currentRound: 0,
    phaseStartedAt: null,
    phaseEndsAt: null,
    phaseRemainingSeconds: null,
  }],
  studySessionSegments: [{ id: SEGMENT_ID, sessionId: SESSION_ID, segmentKind: 'free', pomodoroRound: null, pomodoroCompletedAt: null, startedAt: '2026-08-10T09:05:00+08:00', endedAt: '2026-08-10T09:53:00+08:00' }],
  studyPreferences: { defaultMode: 'pomodoro', focusSeconds: 1500, shortBreakSeconds: 300, longBreakSeconds: 900, roundsBeforeLongBreak: 4, soundEnabled: false, vibrationEnabled: true },
}

describe('备份导入校验', () => {
  it('忽略文件中的 user_id，只保留可导入字段', () => {
    const result = validateImportData(JSON.stringify({
      version: 1,
      exportedAt: '2026-08-04T00:00:00Z',
      tasks: [{ planDate: '2026-08-04', title: '背单词', completed: false, sortOrder: 0, user_id: 'attacker' }],
      planDays: [{ planDate: '2026-08-04', isRestDay: false, note: '', user_id: 'attacker' }],
    }))
    expect(result.tasks[0]).not.toHaveProperty('user_id')
    expect(result.planDays[0]).not.toHaveProperty('user_id')
  })

  it('拒绝错误结构和空任务名称', () => {
    expect(() => validateImportData('{}')).toThrow('导入文件结构不正确')
    expect(() => validateImportData(JSON.stringify({ version: 1, tasks: [{ planDate: '2026-08-04', title: '', sortOrder: 0 }], planDays: [] }))).toThrow('任务数据格式不正确')
  })

  it('版本 2 备份完整解析并保留任务 id 用于恢复关联', () => {
    const result = validateImportData(JSON.stringify(validV2))
    expect(result.version).toBe(2)
    if (result.version !== 2) return
    expect(result.tasks[0].id).toBe(TASK_ID)
    expect(result.studyLocations).toHaveLength(1)
    expect(result.attendanceRecords[0].locationId).toBe(LOCATION_ID)
    expect(result.studySessions[0].taskId).toBe(TASK_ID)
    expect(result.studySessions[0].attendanceRecordId).toBe(ATTENDANCE_ID)
    expect(result.studySessionSegments[0].sessionId).toBe(SESSION_ID)
    expect(result.studySessionSegments[0].pomodoroRound).toBeNull()
    expect(result.studyPreferences?.roundsBeforeLongBreak).toBe(4)
  })

  it('版本 2 拒绝未知字段污染与非法 id', () => {
    const poisoned = { ...validV2, studyLocations: [{ ...validV2.studyLocations[0], user_id: 'attacker' }] }
    const result = validateImportData(JSON.stringify(poisoned))
    if (result.version !== 2) throw new Error('expected v2')
    expect(result.studyLocations[0]).not.toHaveProperty('user_id')

    const badId = { ...validV2, studySessions: [{ ...validV2.studySessions[0], id: 'not-a-uuid' }] }
    expect(() => validateImportData(JSON.stringify(badId))).toThrow('学习会话数据格式不正确')

    const badRadius = { ...validV2, studyLocations: [{ ...validV2.studyLocations[0], radiusM: 50 }] }
    expect(() => validateImportData(JSON.stringify(badRadius))).toThrow('学习地点数据格式不正确')
  })

  it('拒绝未知版本，版本 1 文件仍可导入', () => {
    expect(() => validateImportData(JSON.stringify({ ...validV2, version: 3 }))).toThrow('不支持的导入文件版本')
    const v1 = validateImportData(JSON.stringify({ version: 1, exportedAt: '2026-08-04T00:00:00Z', tasks: [{ planDate: '2026-08-04', title: '背单词', sortOrder: 0 }], planDays: [] }))
    expect(v1.version).toBe(1)
  })
})
