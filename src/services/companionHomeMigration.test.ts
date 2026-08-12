import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260817000000_optimize_companion_home.sql?raw'

describe('搭子首页聚合 RPC 安全迁移', () => {
  it('仅允许已登录用户执行，并固定安全 search_path', () => {
    expect(migration).toContain('create or replace function public.get_companion_home_state()')
    expect(migration).toContain('security definer')
    expect(migration).toContain('set search_path = pg_catalog, public')
    expect(migration).toContain('revoke all on function public.get_companion_home_state() from public, anon')
    expect(migration).toContain('grant execute on function public.get_companion_home_state() to authenticated')
  })

  it('只接受已通过的好友作为首页搭子', () => {
    expect(migration).toContain("f.status = 'accepted'")
    expect(migration).toContain('f.requester_id = uid and f.addressee_id = v_primary_id')
    expect(migration).toContain('f.requester_id = v_primary_id and f.addressee_id = uid')
  })

  it('返回屏幕所需聚合字段，不暴露原始学习、位置或备注数据', () => {
    const outputContract = migration.match(/returns table \(([\s\S]*?)\)\s*language plpgsql/i)?.[1] ?? ''
    expect(outputContract).toContain('companion_studied_minutes integer')
    expect(outputContract).toContain('shared_bloom_dates date[]')
    expect(outputContract).not.toMatch(/latitude|longitude|started_at|ended_at|reflection|task_title|note/i)
    expect(migration).toContain("case when v_companion_level = 'none' then null")
    expect(migration).toContain("case when v_companion_level = 'summary' then floor")
  })
})
