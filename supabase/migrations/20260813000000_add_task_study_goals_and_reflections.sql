-- StudyBloom V0.5.0: task study goals, end-of-session reflections and
-- task-linked study history. Additive and compatible with existing rows.

alter table public.tasks
  add column if not exists estimated_minutes integer;

alter table public.tasks
  drop constraint if exists tasks_estimated_minutes_check;
alter table public.tasks
  add constraint tasks_estimated_minutes_check
  check (estimated_minutes is null or estimated_minutes between 1 and 1440);

alter table public.study_sessions
  add column if not exists reflection text not null default '';

alter table public.study_sessions
  drop constraint if exists study_sessions_reflection_length_check;
alter table public.study_sessions
  add constraint study_sessions_reflection_length_check
  check (char_length(reflection) <= 500);

create index if not exists study_sessions_user_task_time_idx
  on public.study_sessions (user_id, task_id, started_at desc)
  where task_id is not null;

create or replace function public.save_study_session_reflection(
  p_session_id uuid,
  p_reflection text
)
returns public.study_sessions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  uid uuid := auth.uid();
  normalized text := trim(coalesce(p_reflection, ''));
  result public.study_sessions%rowtype;
begin
  if uid is null then
    raise exception '请先登录后再操作';
  end if;
  if char_length(normalized) > 500 then
    raise exception '学习记录不能超过 500 个字符';
  end if;

  update public.study_sessions
  set reflection = normalized
  where id = p_session_id and user_id = uid and ended_at is not null
  returning * into result;

  if not found then
    raise exception '只能为已结束的学习记录填写总结';
  end if;
  return result;
end;
$$;

-- Full backups restore core session rows through restore_study_records. This
-- narrow companion RPC restores only the optional reflection text.
create or replace function public.restore_study_reflections(p_sessions jsonb)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  uid uuid := auth.uid();
  affected integer := 0;
begin
  if uid is null then
    raise exception '请先登录后再操作';
  end if;
  if jsonb_typeof(coalesce(p_sessions, '[]'::jsonb)) <> 'array' then
    raise exception '学习备份数据格式不正确';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_sessions, '[]'::jsonb)) as x(id uuid, reflection text)
    where char_length(coalesce(x.reflection, '')) > 500
  ) then
    raise exception '学习记录不能超过 500 个字符';
  end if;

  update public.study_sessions s
  set reflection = trim(coalesce(x.reflection, ''))
  from jsonb_to_recordset(coalesce(p_sessions, '[]'::jsonb)) as x(id uuid, reflection text)
  where s.id = x.id and s.user_id = uid;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.save_study_session_reflection(uuid, text) from public, anon;
grant execute on function public.save_study_session_reflection(uuid, text) to authenticated;
revoke all on function public.restore_study_reflections(jsonb) from public, anon;
grant execute on function public.restore_study_reflections(jsonb) to authenticated;
