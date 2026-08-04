import { describe, expect, it } from 'vitest'
import { importPlan } from './importExport'

describe('导入服务边界校验', () => {
  it('在访问数据库前拒绝超过 100 字的任务', async () => {
    await expect(importPlan({
      version: 1,
      exportedAt: '2026-08-04T00:00:00Z',
      tasks: [{ planDate: '2026-08-04', title: '学'.repeat(101), completed: false, sortOrder: 0 }],
      planDays: [],
    })).rejects.toThrow('导入任务内容不正确')
  })
})
