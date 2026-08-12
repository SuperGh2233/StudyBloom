import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260816000000_add_companionship.sql?raw'

describe('V0.9.0 搭子数据安全迁移', () => {
  it('保持原始学习记录仅本人可读，只开放最小聚合 RPC', () => {
    expect(migration).toContain('create or replace function public.get_companion_summary')
    expect(migration).toContain("coalesce(access_level, 'none') = 'none'")
    expect(migration).toContain("case when access_level = 'summary' then floor")
    expect(migration).not.toMatch(/create policy\s+\w+\s+on public\.study_sessions[\s\S]*companion/i)
    expect(migration).not.toMatch(/create policy\s+\w+\s+on public\.study_session_segments[\s\S]*companion/i)
  })

  it('默认不分享，禁止匿名调用并固定安全 search_path', () => {
    expect(migration).toContain("share_level text not null default 'none'")
    expect(migration).toContain('set search_path = pg_catalog, public')
    expect(migration).toContain('revoke all on function public.get_companion_summary(uuid, date, date) from public, anon')
    expect(migration).toContain('grant execute on function public.get_companion_summary(uuid, date, date) to authenticated')
  })

  it('非好友、未接受或拉黑关系无法读取概要和送花', () => {
    expect(migration.match(/f\.status = 'accepted'/g)?.length).toBeGreaterThanOrEqual(5)
    expect(migration).toContain("raise exception '好友关系不存在或已失效'")
    expect(migration).toContain("raise exception '只有好友之间可以送花'")
  })

  it('严格限制最近七天，bloom_only 不返回可推断的数量', () => {
    expect(migration).toContain('p_start_date < today_cn - 6')
    expect(migration).toContain('p_end_date - p_start_date > 6')
    expect(migration).toContain("case when access_level = 'summary' then floor")
    expect(migration).toContain("case when access_level = 'summary' then totals.task_completed else null end")
    expect(migration).toContain("case when access_level = 'summary' then totals.task_total else null end")
  })

  it('小花由服务端按中国日期写入并以数据库唯一键保持幂等', () => {
    expect(migration).toContain('unique (sender_id, recipient_id, sent_on, kind)')
    expect(migration).toContain("timezone('Asia/Shanghai', pg_catalog.now())")
    expect(migration).toContain('on conflict (sender_id, recipient_id, sent_on, kind)')
    expect(migration).toContain('revoke insert, update, delete on table public.companion_encouragements from authenticated')
  })

  it('好友关系结束时清除搭子授权、首页搭子和小花', () => {
    expect(migration).toContain('create or replace function public.cleanup_companionship')
    expect(migration).toContain('delete from public.companion_settings')
    expect(migration).toContain('delete from public.companion_encouragements')
    expect(migration).toContain('set primary_companion_id = null')
  })
})
