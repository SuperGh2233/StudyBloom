import { describe, expect, it } from 'vitest'
import { toCsv } from './csvExport'

describe('CSV 导出', () => {
  it('添加 Excel BOM 并正确转义逗号、引号和换行', () => {
    const csv = toCsv([['任务', '感受'], ['英语,阅读', '今天"不错"\n继续']])
    expect(csv.startsWith('\ufeff')).toBe(true)
    expect(csv).toContain('"英语,阅读"')
    expect(csv).toContain('"今天""不错""\n继续"')
  })
})
