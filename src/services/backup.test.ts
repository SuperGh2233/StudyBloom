import { describe, expect, it } from 'vitest'
import { validateImportData } from './backup'

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
})
