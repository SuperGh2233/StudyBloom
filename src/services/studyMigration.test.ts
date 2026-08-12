import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260812000000_harden_study_data_integrity.sql?raw'

describe('V0.4.1 学习数据迁移契约', () => {
  it('撤销核心表直接写权限并提供受控恢复 RPC', () => {
    expect(migration).toContain('revoke insert, update, delete on table')
    expect(migration).toContain('public.attendance_records,')
    expect(migration).toContain('public.study_sessions,')
    expect(migration).toContain('public.study_session_segments')
    expect(migration).toContain('create or replace function public.restore_study_records')
    expect(migration).toContain('security definer')
  })

  it('按片段总时长结束会话并由数据库决定休息类型', () => {
    expect(migration).toContain('sum(extract(epoch from (ended_at - started_at)))')
    expect(migration).toContain("case when studied_seconds >= 60 then 'completed' else 'cancelled' end")
    expect(migration).toContain('mod(session.pomodoro_completed_rounds, session.pomodoro_rounds_before_long_break)')
  })
})
