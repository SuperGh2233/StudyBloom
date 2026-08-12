import { describe, expect, it } from 'vitest'
import { normalizeFriendRemark } from './friendNotes'

describe('好友备注', () => {
  it('清理首尾空格、允许清空并限制长度', () => {
    expect(normalizeFriendRemark('  一起考研  ')).toBe('一起考研')
    expect(normalizeFriendRemark('   ')).toBe('')
    expect(() => normalizeFriendRemark('好'.repeat(31))).toThrow('不能超过 30 个字符')
  })
})
