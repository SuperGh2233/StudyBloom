import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260812000000_harden_study_data_integrity.sql?raw'
import v050Migration from '../../supabase/migrations/20260813000000_add_task_study_goals_and_reflections.sql?raw'

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

describe('V0.5.0 任务学习目标迁移契约', () => {
  it('新增预计时长、学习感受和受控保存函数', () => {
    expect(v050Migration).toContain('add column if not exists estimated_minutes integer')
    expect(v050Migration).toContain("add column if not exists reflection text not null default ''")
    expect(v050Migration).toContain('create or replace function public.save_study_session_reflection')
    expect(v050Migration).toContain('security definer')
    expect(v050Migration).toContain('grant execute on function public.save_study_session_reflection')
  })
})
