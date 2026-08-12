-- StudyBloom V0.4.1: harden study-data writes and make Pomodoro completion
-- dates auditable. This migration is additive and safe for existing data.

-- ---------------------------------------------------------------------------
-- Location invariants
-- ---------------------------------------------------------------------------

-- Keep the oldest default when legacy/concurrent writes created more than one.
with ranked_defaults as (
  select id, row_number() over (partition by user_id order by created_at, id) as position
  from public.study_locations
  where is_default
)
update public.study_locations l
set is_default = false
from ranked_defaults r
where l.id = r.id and r.position > 1;

create unique index if not exists study_locations_one_default_per_user_idx
  on public.study_locations (user_id)
  where is_default;

-- ---------------------------------------------------------------------------
-- Pomodoro round provenance
-- ---------------------------------------------------------------------------

alter table public.study_session_segments
  add column if not exists pomodoro_round integer,
  add column if not exists pomodoro_completed_at timestamptz;

alter table public.study_session_segments
  drop constraint if exists study_session_segments_pomodoro_round_check;
alter table public.study_session_segments
  add constraint study_session_segments_pomodoro_round_check
  check (pomodoro_round is null or pomodoro_round > 0);

alter table public.study_session_segments
  drop constraint if exists study_session_segments_pomodoro_completion_check;
alter table public.study_session_segments
  add constraint study_session_segments_pomodoro_completion_check
  check (
    pomodoro_completed_at is null
    or (segment_kind = 'focus' and pomodoro_round is not null and ended_at is not null)
  );

create index if not exists study_segments_completed_round_idx
  on public.study_session_segments (user_id, pomodoro_completed_at)
  where pomodoro_completed_at is not null;

-- Every newly created focus fragment inherits the database session round.
create or replace function public.set_study_segment_pomodoro_round()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.segment_kind = 'focus' and new.pomodoro_round is null then
    select s.current_round into new.pomodoro_round
    from public.study_sessions s
    where s.id = new.session_id and s.user_id = new.user_id;
  end if;
  return new;
end;
$$;

revoke all on function public.set_study_segment_pomodoro_round() from public, anon, authenticated;

drop trigger if exists study_segment_set_pomodoro_round on public.study_session_segments;
create trigger study_segment_set_pomodoro_round
before insert on public.study_session_segments
for each row execute function public.set_study_segment_pomodoro_round();

-- Active focus fragments created before this migration can be attributed safely.
update public.study_session_segments seg
set pomodoro_round = s.current_round
from public.study_sessions s
where seg.session_id = s.id
  and seg.segment_kind = 'focus'
  and seg.pomodoro_round is null
  and s.ended_at is null
  and s.current_phase = 'focus'
  and s.current_round > 0
  and (seg.ended_at is null or s.pomodoro_completed_rounds = 0);

-- Existing RPCs increment pomodoro_completed_rounds only after a full focus
-- phase expires. Record the database phase end on every fragment of that round.
create or replace function public.mark_completed_pomodoro_round()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.pomodoro_completed_rounds > old.pomodoro_completed_rounds
     and old.mode = 'pomodoro'
     and old.current_phase = 'focus'
     and old.current_round > 0 then
    update public.study_session_segments
    set pomodoro_round = coalesce(pomodoro_round, old.current_round),
        pomodoro_completed_at = coalesce(pomodoro_completed_at, old.phase_ends_at, now())
    where session_id = old.id
      and user_id = old.user_id
      and segment_kind = 'focus'
      and ended_at is not null
      and (pomodoro_round = old.current_round or pomodoro_round is null);
  end if;
  return new;
end;
$$;

revoke all on function public.mark_completed_pomodoro_round() from public, anon, authenticated;

drop trigger if exists study_session_mark_completed_round on public.study_sessions;
create trigger study_session_mark_completed_round
after update of pomodoro_completed_rounds on public.study_sessions
for each row
when (new.pomodoro_completed_rounds > old.pomodoro_completed_rounds)
execute function public.mark_completed_pomodoro_round();

-- ---------------------------------------------------------------------------
-- Server-authoritative state transitions
-- ---------------------------------------------------------------------------

-- Keep the old two-argument signature for rolling deployments, but the server
-- now derives the next phase. p_phase is validation/backward compatibility only.
create or replace function public.start_next_pomodoro_phase(
  p_session_id uuid,
  p_phase text
)
returns public.study_sessions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  uid uuid := auth.uid();
  session public.study_sessions%rowtype;
  next_phase text;
  phase_seconds integer;
begin
  if uid is null then
    raise exception '请先登录后再操作';
  end if;
  if p_phase is null or p_phase not in ('focus', 'short_break', 'long_break') then
    raise exception '番茄阶段参数不正确';
  end if;

  select * into session
  from public.study_sessions
  where id = p_session_id and user_id = uid
  for update;

  if not found then
    raise exception '学习会话不存在';
  end if;
  if session.mode <> 'pomodoro' then
    raise exception '仅番茄专注支持该操作';
  end if;
  if session.status <> 'waiting' or session.ended_at is not null then
    raise exception '番茄状态不同步，请刷新页面重试';
  end if;

  if session.current_phase = 'focus' then
    next_phase := case
      when session.pomodoro_completed_rounds > 0
       and mod(session.pomodoro_completed_rounds, session.pomodoro_rounds_before_long_break) = 0
        then 'long_break'
      else 'short_break'
    end;
    phase_seconds := case
      when next_phase = 'long_break' then session.pomodoro_long_break_seconds
      else session.pomodoro_short_break_seconds
    end;

    update public.study_sessions
    set status = 'running',
        current_phase = next_phase,
        phase_started_at = now(),
        phase_ends_at = now() + phase_seconds * interval '1 second',
        phase_remaining_seconds = null
    where id = session.id
    returning * into session;
  elsif session.current_phase in ('short_break', 'long_break') then
    update public.study_sessions
    set status = 'running',
        current_phase = 'focus',
        current_round = pomodoro_completed_rounds + 1,
        phase_started_at = now(),
        phase_ends_at = now() + pomodoro_focus_seconds * interval '1 second',
        phase_remaining_seconds = null
    where id = session.id
    returning * into session;

    insert into public.study_session_segments (user_id, session_id, segment_kind, started_at)
    values (uid, session.id, 'focus', now());
  else
    raise exception '番茄状态不同步，请刷新页面重试';
  end if;

  return session;
end;
$$;

-- Session completion is based on total studied time, not one contiguous fragment.
create or replace function public.finish_study_session(p_session_id uuid)
returns public.study_sessions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  uid uuid := auth.uid();
  session public.study_sessions%rowtype;
  studied_seconds double precision := 0;
begin
  if uid is null then
    raise exception '请先登录后再操作';
  end if;

  select * into session
  from public.study_sessions
  where id = p_session_id and user_id = uid
  for update;

  if not found then
    raise exception '学习会话不存在';
  end if;
  if session.ended_at is not null then
    return session;
  end if;

  if session.status = 'running'
     and session.mode = 'pomodoro'
     and session.current_phase = 'focus'
     and session.phase_ends_at is not null
     and session.phase_ends_at <= now() then
    update public.study_session_segments
    set ended_at = session.phase_ends_at
    where session_id = session.id and ended_at is null;

    update public.study_sessions
    set pomodoro_completed_rounds = pomodoro_completed_rounds + 1
    where id = session.id;
  end if;

  update public.study_session_segments
  set ended_at = least(now(), coalesce(session.phase_ends_at, now()))
  where session_id = session.id and ended_at is null;

  select coalesce(sum(extract(epoch from (ended_at - started_at))), 0)
  into studied_seconds
  from public.study_session_segments
  where session_id = session.id and ended_at is not null;

  update public.study_sessions
  set status = case when studied_seconds >= 60 then 'completed' else 'cancelled' end,
      ended_at = now(),
      current_phase = null,
      phase_started_at = null,
      phase_ends_at = null,
      phase_remaining_seconds = null
  where id = session.id
  returning * into session;

  return session;
end;
$$;

-- All mutating state functions execute as their owner and still scope every
-- operation to auth.uid(). This lets table DML be revoked from browser clients.
alter function public.check_in_at_location(uuid, double precision, double precision, double precision) security definer;
alter function public.check_in_at_location(uuid, double precision, double precision, double precision) set search_path = pg_catalog, public;
alter function public.check_out_from_location(double precision, double precision, double precision) security definer;
alter function public.check_out_from_location(double precision, double precision, double precision) set search_path = pg_catalog, public;
alter function public.force_close_attendance() security definer;
alter function public.force_close_attendance() set search_path = pg_catalog, public;
alter function public.start_study_session(text, uuid, integer, integer, integer, integer) security definer;
alter function public.start_study_session(text, uuid, integer, integer, integer, integer) set search_path = pg_catalog, public;
alter function public.pause_study_session(uuid) security definer;
alter function public.pause_study_session(uuid) set search_path = pg_catalog, public;
alter function public.resume_study_session(uuid) security definer;
alter function public.resume_study_session(uuid) set search_path = pg_catalog, public;
alter function public.sync_pomodoro_session(uuid) security definer;
alter function public.sync_pomodoro_session(uuid) set search_path = pg_catalog, public;
alter function public.start_next_pomodoro_phase(uuid, text) security definer;
alter function public.start_next_pomodoro_phase(uuid, text) set search_path = pg_catalog, public;
alter function public.skip_pomodoro_break(uuid) security definer;
alter function public.skip_pomodoro_break(uuid) set search_path = pg_catalog, public;
alter function public.end_current_focus_round(uuid) security definer;
alter function public.end_current_focus_round(uuid) set search_path = pg_catalog, public;
alter function public.finish_study_session(uuid) security definer;
alter function public.finish_study_session(uuid) set search_path = pg_catalog, public;

-- ---------------------------------------------------------------------------
-- Validated full-backup restore path
-- ---------------------------------------------------------------------------

create or replace function public.restore_study_records(
  p_attendance jsonb,
  p_sessions jsonb,
  p_segments jsonb
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  uid uuid := auth.uid();
  inserted integer := 0;
  affected integer := 0;
begin
  if uid is null then
    raise exception '请先登录后再操作';
  end if;
  if jsonb_typeof(coalesce(p_attendance, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_sessions, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_segments, '[]'::jsonb)) <> 'array' then
    raise exception '学习备份数据格式不正确';
  end if;

  insert into public.attendance_records (
    id, user_id, location_id, check_in_at,
    check_in_latitude, check_in_longitude, check_in_accuracy_m, check_in_distance_m,
    check_out_at, check_out_latitude, check_out_longitude,
    check_out_accuracy_m, check_out_distance_m, manual_closed
  )
  select x.id, uid, x.location_id, x.check_in_at,
         x.check_in_latitude, x.check_in_longitude, x.check_in_accuracy_m, x.check_in_distance_m,
         x.check_out_at, x.check_out_latitude, x.check_out_longitude,
         x.check_out_accuracy_m, x.check_out_distance_m, coalesce(x.manual_closed, false)
  from jsonb_to_recordset(coalesce(p_attendance, '[]'::jsonb)) as x(
    id uuid, location_id uuid, check_in_at timestamptz,
    check_in_latitude double precision, check_in_longitude double precision,
    check_in_accuracy_m double precision, check_in_distance_m double precision,
    check_out_at timestamptz, check_out_latitude double precision,
    check_out_longitude double precision, check_out_accuracy_m double precision,
    check_out_distance_m double precision, manual_closed boolean
  )
  join public.study_locations l on l.id = x.location_id and l.user_id = uid
  on conflict (id) do nothing;
  get diagnostics affected = row_count;
  inserted := inserted + affected;

  insert into public.study_sessions (
    id, user_id, task_id, task_title_snapshot, attendance_record_id,
    plan_date, mode, status, started_at, ended_at,
    pomodoro_focus_seconds, pomodoro_short_break_seconds,
    pomodoro_long_break_seconds, pomodoro_rounds_before_long_break,
    pomodoro_completed_rounds, current_phase, current_round,
    phase_started_at, phase_ends_at, phase_remaining_seconds
  )
  select x.id, uid,
         case when t.id is not null then x.task_id else null end,
         coalesce(x.task_title_snapshot, ''),
         case when a.id is not null then x.attendance_record_id else null end,
         x.plan_date, x.mode, x.status, x.started_at, x.ended_at,
         x.pomodoro_focus_seconds, x.pomodoro_short_break_seconds,
         x.pomodoro_long_break_seconds, x.pomodoro_rounds_before_long_break,
         coalesce(x.pomodoro_completed_rounds, 0), x.current_phase,
         coalesce(x.current_round, 0), x.phase_started_at,
         x.phase_ends_at, x.phase_remaining_seconds
  from jsonb_to_recordset(coalesce(p_sessions, '[]'::jsonb)) as x(
    id uuid, task_id uuid, task_title_snapshot text, attendance_record_id uuid,
    plan_date date, mode text, status text, started_at timestamptz, ended_at timestamptz,
    pomodoro_focus_seconds integer, pomodoro_short_break_seconds integer,
    pomodoro_long_break_seconds integer, pomodoro_rounds_before_long_break integer,
    pomodoro_completed_rounds integer, current_phase text, current_round integer,
    phase_started_at timestamptz, phase_ends_at timestamptz,
    phase_remaining_seconds integer
  )
  left join public.tasks t on t.id = x.task_id and t.user_id = uid
  left join public.attendance_records a on a.id = x.attendance_record_id and a.user_id = uid
  on conflict (id) do nothing;
  get diagnostics affected = row_count;
  inserted := inserted + affected;

  insert into public.study_session_segments (
    id, user_id, session_id, segment_kind, started_at, ended_at,
    pomodoro_round, pomodoro_completed_at
  )
  select x.id, uid, x.session_id, x.segment_kind, x.started_at, x.ended_at,
         case when x.segment_kind = 'focus' then x.pomodoro_round else null end,
         case when x.segment_kind = 'focus' then x.pomodoro_completed_at else null end
  from jsonb_to_recordset(coalesce(p_segments, '[]'::jsonb)) as x(
    id uuid, session_id uuid, segment_kind text, started_at timestamptz,
    ended_at timestamptz, pomodoro_round integer, pomodoro_completed_at timestamptz
  )
  join public.study_sessions s on s.id = x.session_id and s.user_id = uid
  on conflict (id) do nothing;
  get diagnostics affected = row_count;
  inserted := inserted + affected;

  return inserted;
end;
$$;

revoke all on function public.restore_study_records(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.restore_study_records(jsonb, jsonb, jsonb) to authenticated;

-- Browser clients may read their rows, but only the RPCs above may mutate the
-- location-validated attendance and database-timed session records.
revoke insert, update, delete on table
  public.attendance_records,
  public.study_sessions,
  public.study_session_segments
from authenticated;

grant select on table
  public.attendance_records,
  public.study_sessions,
  public.study_session_segments
to authenticated;
