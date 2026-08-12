-- StudyBloom core data model.

create extension if not exists pgcrypto;

create table if not exists public.plan_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_date date not null,
  is_rest_day boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_date)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_date date not null,
  title text not null,
  completed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_date_order_idx
  on public.tasks (user_id, plan_date, sort_order, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists plan_days_set_updated_at on public.plan_days;
create trigger plan_days_set_updated_at
before update on public.plan_days
for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- New tables are not exposed automatically. Grant only the authenticated role;
-- row-level policies below still restrict every user to their own records.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.plan_days, public.tasks to authenticated;
revoke all on table public.plan_days, public.tasks from anon;

alter table public.plan_days enable row level security;
alter table public.tasks enable row level security;

drop policy if exists plan_days_select_own on public.plan_days;
create policy plan_days_select_own
on public.plan_days for select
using (auth.uid() = user_id);

drop policy if exists plan_days_insert_own on public.plan_days;
create policy plan_days_insert_own
on public.plan_days for insert
with check (auth.uid() = user_id);

drop policy if exists plan_days_update_own on public.plan_days;
create policy plan_days_update_own
on public.plan_days for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists plan_days_delete_own on public.plan_days;
create policy plan_days_delete_own
on public.plan_days for delete
using (auth.uid() = user_id);

drop policy if exists tasks_select_own on public.tasks;
create policy tasks_select_own
on public.tasks for select
using (auth.uid() = user_id);

drop policy if exists tasks_insert_own on public.tasks;
create policy tasks_insert_own
on public.tasks for insert
with check (auth.uid() = user_id);

drop policy if exists tasks_update_own on public.tasks;
create policy tasks_update_own
on public.tasks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists tasks_delete_own on public.tasks;
create policy tasks_delete_own
on public.tasks for delete
using (auth.uid() = user_id);

-- Study module: study locations, location check-in/out (attendance), study
-- sessions (free timing + pomodoro focus), timing segments and cross-device
-- preferences. Depends on set_updated_at() from the initial schema.
--
-- Privacy: every table is owner-only. Friends can never read locations,
-- coordinates, attendance or study time. No PostGIS; distances use a plain
-- Haversine function. Browser geolocation can be spoofed, this is a personal
-- study aid, not a tamper-proof attendance system.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Haversine distance in meters (earth radius 6371 km)
-- ---------------------------------------------------------------------------

create or replace function public.haversine_distance_m(
  lat1 double precision,
  lon1 double precision,
  lat2 double precision,
  lon2 double precision
)
returns double precision
language sql
immutable
set search_path = public
as $$
  select 6371000 * 2 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  )))
$$;

-- ---------------------------------------------------------------------------
-- study_locations
-- ---------------------------------------------------------------------------

create table if not exists public.study_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 50),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_m integer not null default 200 check (radius_m between 100 and 1000),
  is_active boolean not null default true,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_locations_user_idx on public.study_locations (user_id);

-- ---------------------------------------------------------------------------
-- attendance_records (location check-in / check-out)
-- ---------------------------------------------------------------------------

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  location_id uuid not null references public.study_locations (id) on delete restrict,
  check_in_at timestamptz not null default now(),
  check_in_latitude double precision not null check (check_in_latitude between -90 and 90),
  check_in_longitude double precision not null check (check_in_longitude between -180 and 180),
  check_in_accuracy_m double precision not null check (check_in_accuracy_m >= 0),
  check_in_distance_m double precision not null check (check_in_distance_m >= 0),
  check_out_at timestamptz,
  check_out_latitude double precision check (check_out_latitude between -90 and 90),
  check_out_longitude double precision check (check_out_longitude between -180 and 180),
  check_out_accuracy_m double precision check (check_out_accuracy_m >= 0),
  check_out_distance_m double precision check (check_out_distance_m >= 0),
  manual_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out_at is null or check_out_at >= check_in_at)
);

-- At most one open (not checked out) record per user.
create unique index if not exists attendance_one_open_per_user_idx
  on public.attendance_records (user_id)
  where check_out_at is null;

create index if not exists attendance_user_time_idx
  on public.attendance_records (user_id, check_in_at desc);

-- ---------------------------------------------------------------------------
-- study_sessions
-- ---------------------------------------------------------------------------

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  task_title_snapshot text not null default '',
  attendance_record_id uuid references public.attendance_records (id) on delete set null,
  plan_date date not null,
  mode text not null check (mode in ('free', 'pomodoro')),
  status text not null default 'running' check (status in ('running', 'paused', 'waiting', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  pomodoro_focus_seconds integer check (pomodoro_focus_seconds between 900 and 5400),
  pomodoro_short_break_seconds integer check (pomodoro_short_break_seconds between 180 and 1800),
  pomodoro_long_break_seconds integer check (pomodoro_long_break_seconds between 600 and 3600),
  pomodoro_rounds_before_long_break integer check (pomodoro_rounds_before_long_break between 2 and 8),
  pomodoro_completed_rounds integer not null default 0 check (pomodoro_completed_rounds >= 0),
  current_phase text check (current_phase in ('focus', 'short_break', 'long_break')),
  current_round integer not null default 0 check (current_round >= 0),
  phase_started_at timestamptz,
  phase_ends_at timestamptz,
  phase_remaining_seconds integer check (phase_remaining_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  check (
    mode = 'pomodoro'
    or (
      pomodoro_focus_seconds is null
      and pomodoro_short_break_seconds is null
      and pomodoro_long_break_seconds is null
      and pomodoro_rounds_before_long_break is null
      and current_phase is null
    )
  )
);

-- At most one unfinished session per user (ended_at null = active).
create unique index if not exists study_sessions_one_open_per_user_idx
  on public.study_sessions (user_id)
  where ended_at is null;

create index if not exists study_sessions_user_date_idx
  on public.study_sessions (user_id, plan_date);

-- ---------------------------------------------------------------------------
-- study_session_segments (the only source of truth for studied time)
-- ---------------------------------------------------------------------------

create table if not exists public.study_session_segments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.study_sessions (id) on delete cascade,
  segment_kind text not null check (segment_kind in ('free', 'focus')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

-- One open segment per session at most.
create unique index if not exists segments_one_open_per_session_idx
  on public.study_session_segments (session_id)
  where ended_at is null;

create index if not exists segments_user_time_idx
  on public.study_session_segments (user_id, started_at);

create index if not exists segments_session_idx
  on public.study_session_segments (session_id);

-- ---------------------------------------------------------------------------
-- study_preferences (pomodoro settings sync across devices)
-- ---------------------------------------------------------------------------

create table if not exists public.study_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  default_mode text not null default 'free' check (default_mode in ('free', 'pomodoro')),
  focus_seconds integer not null default 1500 check (focus_seconds between 900 and 5400),
  short_break_seconds integer not null default 300 check (short_break_seconds between 180 and 1800),
  long_break_seconds integer not null default 900 check (long_break_seconds between 600 and 3600),
  rounds_before_long_break integer not null default 4 check (rounds_before_long_break between 2 and 8),
  sound_enabled boolean not null default false,
  vibration_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse the shared helper)
-- ---------------------------------------------------------------------------

drop trigger if exists study_locations_set_updated_at on public.study_locations;
create trigger study_locations_set_updated_at
before update on public.study_locations
for each row execute function public.set_updated_at();

drop trigger if exists attendance_records_set_updated_at on public.attendance_records;
create trigger attendance_records_set_updated_at
before update on public.attendance_records
for each row execute function public.set_updated_at();

drop trigger if exists study_sessions_set_updated_at on public.study_sessions;
create trigger study_sessions_set_updated_at
before update on public.study_sessions
for each row execute function public.set_updated_at();

drop trigger if exists study_preferences_set_updated_at on public.study_preferences;
create trigger study_preferences_set_updated_at
before update on public.study_preferences
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants: authenticated only, anon gets nothing
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on table
  public.study_locations,
  public.attendance_records,
  public.study_sessions,
  public.study_session_segments,
  public.study_preferences
to authenticated;

revoke all on table
  public.study_locations,
  public.attendance_records,
  public.study_sessions,
  public.study_session_segments,
  public.study_preferences
from anon;

-- ---------------------------------------------------------------------------
-- Row level security: owner-only, no friend access at all
-- ---------------------------------------------------------------------------

alter table public.study_locations enable row level security;
alter table public.attendance_records enable row level security;
alter table public.study_sessions enable row level security;
alter table public.study_session_segments enable row level security;
alter table public.study_preferences enable row level security;

drop policy if exists study_locations_select_own on public.study_locations;
create policy study_locations_select_own on public.study_locations for select
using (auth.uid() = user_id);

drop policy if exists study_locations_insert_own on public.study_locations;
create policy study_locations_insert_own on public.study_locations for insert
with check (auth.uid() = user_id);

drop policy if exists study_locations_update_own on public.study_locations;
create policy study_locations_update_own on public.study_locations for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists study_locations_delete_own on public.study_locations;
create policy study_locations_delete_own on public.study_locations for delete
using (auth.uid() = user_id);

drop policy if exists attendance_records_select_own on public.attendance_records;
create policy attendance_records_select_own on public.attendance_records for select
using (auth.uid() = user_id);

-- Foreign keys are validated bypassing RLS, so every write policy must also
-- prove the referenced parent row belongs to the caller (same exists()
-- pattern the friend-system migration uses).
drop policy if exists attendance_records_insert_own on public.attendance_records;
create policy attendance_records_insert_own on public.attendance_records for insert
with check (
  auth.uid() = user_id
  and exists (select 1 from public.study_locations l where l.id = location_id and l.user_id = auth.uid())
);

drop policy if exists attendance_records_update_own on public.attendance_records;
create policy attendance_records_update_own on public.attendance_records for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.study_locations l where l.id = location_id and l.user_id = auth.uid())
);

drop policy if exists attendance_records_delete_own on public.attendance_records;
create policy attendance_records_delete_own on public.attendance_records for delete
using (auth.uid() = user_id);

drop policy if exists study_sessions_select_own on public.study_sessions;
create policy study_sessions_select_own on public.study_sessions for select
using (auth.uid() = user_id);

drop policy if exists study_sessions_insert_own on public.study_sessions;
create policy study_sessions_insert_own on public.study_sessions for insert
with check (
  auth.uid() = user_id
  and (task_id is null or exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid()))
  and (attendance_record_id is null or exists (select 1 from public.attendance_records a where a.id = attendance_record_id and a.user_id = auth.uid()))
);

drop policy if exists study_sessions_update_own on public.study_sessions;
create policy study_sessions_update_own on public.study_sessions for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (task_id is null or exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid()))
  and (attendance_record_id is null or exists (select 1 from public.attendance_records a where a.id = attendance_record_id and a.user_id = auth.uid()))
);

drop policy if exists study_sessions_delete_own on public.study_sessions;
create policy study_sessions_delete_own on public.study_sessions for delete
using (auth.uid() = user_id);

drop policy if exists study_session_segments_select_own on public.study_session_segments;
create policy study_session_segments_select_own on public.study_session_segments for select
using (auth.uid() = user_id);

drop policy if exists study_session_segments_insert_own on public.study_session_segments;
create policy study_session_segments_insert_own on public.study_session_segments for insert
with check (
  auth.uid() = user_id
  and exists (select 1 from public.study_sessions s where s.id = session_id and s.user_id = auth.uid())
);

drop policy if exists study_session_segments_update_own on public.study_session_segments;
create policy study_session_segments_update_own on public.study_session_segments for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.study_sessions s where s.id = session_id and s.user_id = auth.uid())
);

drop policy if exists study_session_segments_delete_own on public.study_session_segments;
create policy study_session_segments_delete_own on public.study_session_segments for delete
using (auth.uid() = user_id);

drop policy if exists study_preferences_select_own on public.study_preferences;
create policy study_preferences_select_own on public.study_preferences for select
using (auth.uid() = user_id);

drop policy if exists study_preferences_insert_own on public.study_preferences;
create policy study_preferences_insert_own on public.study_preferences for insert
with check (auth.uid() = user_id);

drop policy if exists study_preferences_update_own on public.study_preferences;
create policy study_preferences_update_own on public.study_preferences for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists study_preferences_delete_own on public.study_preferences;
create policy study_preferences_delete_own on public.study_preferences for delete
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Attendance RPCs
-- ---------------------------------------------------------------------------

-- Check in at one of the caller's active locations. Validates accuracy and
-- recomputes the Haversine distance server-side; writes database time.
-- Idempotent: repeating the same check-in returns the existing open record.
create or replace function public.check_in_at_location(
  p_location_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision
)
returns public.attendance_records
language plpgsql
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  loc public.study_locations%rowtype;
  open_record public.attendance_records%rowtype;
  distance_m double precision;
  result public.attendance_records%rowtype;
begin
  if uid is null then
    raise exception '请先登录后再操作';
  end if;

  select * into loc
  from public.study_locations
  where id = p_location_id and user_id = uid;
  if not found then
    raise exception '学习地点不存在';
  end if;
  if not loc.is_active then
    raise exception '该学习地点已停用，请选择其他地点';
  end if;

  if p_accuracy_m is null or p_accuracy_m < 0 then
    raise exception '定位数据不正确';
  end if;
  if p_accuracy_m > 150 then
    raise exception '当前定位精度不足，请移动到窗边或室外后重试。';
  end if;

  select * into open_record
  from public.attendance_records
  where user_id = uid and check_out_at is null
  for update;
  if found then
    if open_record.location_id = p_location_id then
      return open_record;
    end if;
    raise exception '已经签到，请先签退后再签到';
  end if;

  distance_m := public.haversine_distance_m(p_latitude, p_longitude, loc.latitude, loc.longitude);
  if distance_m > loc.radius_m then
    raise exception '%', format(
      '你距离「%s」约 %s 米，允许签到范围为 %s 米。',
      loc.name, round(distance_m)::integer, loc.radius_m
    );
  end if;

  insert into public.attendance_records (
    user_id, location_id, check_in_at,
    check_in_latitude, check_in_longitude, check_in_accuracy_m, check_in_distance_m
  ) values (
    uid, loc.id, now(),
    p_latitude, p_longitude, p_accuracy_m, round(distance_m * 10) / 10
  )
  returning * into result;
  return result;
exception
  when unique_violation then
    select * into open_record
    from public.attendance_records
    where user_id = uid and check_out_at is null;
    if found and open_record.location_id = p_location_id then
      return open_record;
    end if;
    raise exception '已经签到，请先签退后再签到';
end;
$$;

-- Normal check-out: still requires position accuracy and being inside the
-- location radius. Idempotent under concurrent duplicate calls.
create or replace function public.check_out_from_location(
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision
)
returns public.attendance_records
language plpgsql
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  open_record public.attendance_records%rowtype;
  loc public.study_locations%rowtype;
  distance_m double precision;
  result public.attendance_records%rowtype;
begin
  if uid is null then
    raise exception '请先登录后再操作';
  end if;

  select * into open_record
  from public.attendance_records
  where user_id = uid and check_out_at is null
  order by check_in_at desc
  limit 1;
  if not found then
    raise exception '没有可签退的记录';
  end if;

  if p_accuracy_m is null or p_accuracy_m < 0 then
    raise exception '定位数据不正确';
  end if;
  if p_accuracy_m > 150 then
    raise exception '当前定位精度不足，请移动到窗边或室外后重试。';
  end if;

  select * into loc from public.study_locations where id = open_record.location_id;
  if not found then
    raise exception '学习地点不存在';
  end if;

  distance_m := public.haversine_distance_m(p_latitude, p_longitude, loc.latitude, loc.longitude);
  if distance_m > loc.radius_m then
    raise exception '%', format(
      '你距离「%s」约 %s 米，允许签退范围为 %s 米。',
      loc.name, round(distance_m)::integer, loc.radius_m
    );
  end if;

  update public.attendance_records
  set check_out_at = now(),
      check_out_latitude = p_latitude,
      check_out_longitude = p_longitude,
      check_out_accuracy_m = p_accuracy_m,
      check_out_distance_m = round(distance_m * 10) / 10
  where id = open_record.id and check_out_at is null
  returning * into result;

  if not found then
    -- A concurrent request already closed it: return the freshest closed one.
    select * into result
    from public.attendance_records
    where user_id = uid and check_out_at is not null
    order by check_out_at desc
    limit 1;
  end if;
  return result;
end;
$$;

-- Secondary exit for "I forgot to check out": closes the open record without
-- any position check, flagged manual_closed so it never counts as valid
-- presence time. Does not replace the normal location check-out.
create or replace function public.force_close_attendance()
returns public.attendance_records
language plpgsql
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result public.attendance_records%rowtype;
begin
  if uid is null then
    raise exception '请先登录后再操作';
  end if;

  update public.attendance_records
  set check_out_at = now(), manual_closed = true
  where user_id = uid and check_out_at is null
  returning * into result;

  if not found then
    -- A concurrent duplicate call already closed it: return the freshest one.
    select * into result
    from public.attendance_records
    where user_id = uid and check_out_at is not null
    order by check_out_at desc
    limit 1;
    if not found then
      raise exception '没有可结束的记录';
    end if;
  end if;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Study session RPCs
-- ---------------------------------------------------------------------------

-- Start the only allowed active session. Free mode gets one open segment
-- right away; pomodoro starts round 1 focus with a planned end time.
create or replace function public.start_study_session(
  p_mode text,
  p_task_id uuid default null,
  p_focus_seconds integer default null,
  p_short_break_seconds integer default null,
  p_long_break_seconds integer default null,
  p_rounds_before_long_break integer default null
)
returns public.study_sessions
language plpgsql
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing public.study_sessions%rowtype;
  task_title text := '';
  open_attendance uuid;
  focus_seconds integer;
  result public.study_sessions%rowtype;
begin
  if uid is null then
    raise exception '请先登录后再操作';
  end if;
  if p_mode not in ('free', 'pomodoro') then
    raise exception '学习模式参数不正确';
  end if;

  select * into existing from public.study_sessions where user_id = uid and ended_at is null;
  if found then
    raise exception '已有学习会话正在进行，请先结束当前学习';
  end if;

  if p_task_id is not null then
    select title into task_title from public.tasks where id = p_task_id and user_id = uid;
    if not found then
      raise exception '关联的任务不存在';
    end if;
  end if;

  select id into open_attendance
  from public.attendance_records
  where user_id = uid and check_out_at is null
  order by check_in_at desc
  limit 1;

  if p_mode = 'pomodoro' then
    focus_seconds := coalesce(p_focus_seconds, 1500);
    if focus_seconds not between 900 and 5400 then
      raise exception '专注时长需在 15 至 90 分钟之间';
    end if;
    if coalesce(p_short_break_seconds, 300) not between 180 and 1800 then
      raise exception '短休息时长需在 3 至 30 分钟之间';
    end if;
    if coalesce(p_long_break_seconds, 900) not between 600 and 3600 then
      raise exception '长休息时长需在 10 至 60 分钟之间';
    end if;
    if coalesce(p_rounds_before_long_break, 4) not between 2 and 8 then
      raise exception '长休息间隔需在 2 至 8 轮之间';
    end if;
  end if;

  insert into public.study_sessions (
    user_id, task_id, task_title_snapshot, attendance_record_id, plan_date,
    mode, status, started_at,
    pomodoro_focus_seconds, pomodoro_short_break_seconds, pomodoro_long_break_seconds,
    pomodoro_rounds_before_long_break, pomodoro_completed_rounds,
    current_phase, current_round, phase_started_at, phase_ends_at
  ) values (
    uid, p_task_id, task_title, open_attendance,
    (now() at time zone 'Asia/Shanghai')::date,
    p_mode, 'running', now(),
    case when p_mode = 'pomodoro' then coalesce(p_focus_seconds, 1500) end,
    case when p_mode = 'pomodoro' then coalesce(p_short_break_seconds, 300) end,
    case when p_mode = 'pomodoro' then coalesce(p_long_break_seconds, 900) end,
    case when p_mode = 'pomodoro' then coalesce(p_rounds_before_long_break, 4) end,
    0,
    case when p_mode = 'pomodoro' then 'focus' end,
    case when p_mode = 'pomodoro' then 1 else 0 end,
    case when p_mode = 'pomodoro' then now() end,
    case when p_mode = 'pomodoro' then now() + coalesce(p_focus_seconds, 1500) * interval '1 second' end
  )
  returning * into result;

  insert into public.study_session_segments (user_id, session_id, segment_kind, started_at)
  values (uid, result.id, case when p_mode = 'pomodoro' then 'focus' else 'free' end, now());

  return result;
exception
  when unique_violation then
    raise exception '请勿重复开启学习模式';
end;
$$;

-- Pause: only legal while running, and for pomodoro only inside the focus
-- phase. Closes the open segment at database time and keeps the remaining
-- phase time for an exact resume. Idempotent when already paused.
create or replace function public.pause_study_session(p_session_id uuid)
returns public.study_sessions
language plpgsql
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  session public.study_sessions%rowtype;
begin
  if uid is null then
    raise exception '请先登录后再操作';
  end if;

  select * into session from public.study_sessions
  where id = p_session_id and user_id = uid
  for update;
  if not found then
    raise exception '学习会话不存在';
  end if;
  if session.status = 'paused' then
    return session;
  end if;
  if session.status <> 'running' or session.ended_at is not null then
    raise exception '当前学习状态不能暂停';
  end if;
  if session.mode = 'pomodoro' and session.current_phase <> 'focus' then
    raise exception '休息阶段无需暂停';
  end if;

  -- The phase may have expired while the page was throttled/backgrounded.
  -- Apply the same catch-up as sync_pomodoro_session instead of pausing.
  if session.mode = 'pomodoro' and session.phase_ends_at is not null and session.phase_ends_at <= now() then
    if session.current_phase = 'focus' then
      update public.study_session_segments
      set ended_at = session.phase_ends_at
      where session_id = session.id and ended_at is null;
    end if;
    update public.study_sessions
    set status = 'waiting',
        phase_started_at = null,
        phase_ends_at = null,
        phase_remaining_seconds = null,
        pomodoro_completed_rounds = case
          when current_phase = 'focus' then pomodoro_completed_rounds + 1
          else pomodoro_completed_rounds
        end
    where id = session.id
    returning * into session;
    return session;
  end if;

  update public.study_session_segments
  set ended_at = now()
  where session_id = session.id and ended_at is null;

  if session.mode = 'pomodoro' then
    update public.study_sessions
    set status = 'paused',
        phase_remaining_seconds = greatest(1, floor(extract(epoch from (phase_ends_at - now())))::integer),
        phase_started_at = null,
        phase_ends_at = null
    where id = session.id
    returning * into session;
  else
    update public.study_sessions
    set status = 'paused'
    where id = session.id
    returning * into session;
  end if;
  return session;
end;
$$;

-- Resume from pause: opens a fresh segment (and re-arms the phase end time
-- from the stored remainder). Idempotent when already running.
create or replace function public.resume_study_session(p_session_id uuid)
returns public.study_sessions
language plpgsql
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  session public.study_sessions%rowtype;
begin
  if uid is null then
    raise exception '请先登录后再操作';
  end if;

  select * into session from public.study_sessions
  where id = p_session_id and user_id = uid
  for update;
  if not found then
    raise exception '学习会话不存在';
  end if;
  if session.status = 'running' then
    return session;
  end if;
  if session.status <> 'paused' or session.ended_at is not null then
    raise exception '当前学习状态不能继续';
  end if;

  if session.mode = 'pomodoro' then
    update public.study_sessions
    set status = 'running',
        phase_started_at = now(),
        phase_ends_at = now() + coalesce(phase_remaining_seconds, pomodoro_focus_seconds) * interval '1 second',
        phase_remaining_seconds = null
    where id = session.id
    returning * into session;

    insert into public.study_session_segments (user_id, session_id, segment_kind, started_at)
    values (uid, session.id, 'focus', now());
  else
    update public.study_sessions
    set status = 'running'
    where id = session.id
    returning * into session;

    insert into public.study_session_segments (user_id, session_id, segment_kind, started_at)
    values (uid, session.id, 'free', now());
  end if;
  return session;
end;
$$;

-- Idempotent catch-up after reload/background/multi-device: any phase whose
-- planned end time has passed is closed exactly at phase_ends_at. An expired
-- focus phase closes its segment at the planned end time and counts one full
-- round; the session then waits for the user's next manual step. The just-
-- finished phase is kept in current_phase so the client can tell whether the
-- next action is a break (after focus) or the next round (after a break).
create or replace function public.sync_pomodoro_session(p_session_id uuid)
returns public.study_sessions
language plpgsql
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  session public.study_sessions%rowtype;
begin
  if uid is null then
    raise exception '请先登录后再操作';
  end if;

  select * into session from public.study_sessions
  where id = p_session_id and user_id = uid
  for update;
  if not found then
    return null;
  end if;

  if session.status <> 'running'
     or session.phase_ends_at is null
     or session.phase_ends_at > now() then
    return session;
  end if;

  if session.mode = 'pomodoro' and session.current_phase = 'focus' then
    update public.study_session_segments
    set ended_at = session.phase_ends_at
    where session_id = session.id and ended_at is null;
  end if;

  update public.study_sessions
  set status = 'waiting',
      phase_started_at = null,
      phase_ends_at = null,
      phase_remaining_seconds = null,
      pomodoro_completed_rounds = case
        when mode = 'pomodoro' and current_phase = 'focus' then pomodoro_completed_rounds + 1
        else pomodoro_completed_rounds
      end
  where id = session.id
  returning * into session;
  return session;
end;
$$;

-- From "waiting": start the break chosen by the client, or the next focus
-- round. current_phase still names the phase that just finished, which is
-- what makes the transitions verifiable.
create or replace function public.start_next_pomodoro_phase(
  p_session_id uuid,
  p_phase text
)
returns public.study_sessions
language plpgsql
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  session public.study_sessions%rowtype;
  phase_seconds integer;
begin
  if uid is null then
    raise exception '请先登录后再操作';
  end if;

  select * into session from public.study_sessions
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

  if p_phase in ('short_break', 'long_break') then
    if session.current_phase <> 'focus' then
      raise exception '番茄状态不同步，请刷新页面重试';
    end if;
    phase_seconds := case
      when p_phase = 'short_break' then session.pomodoro_short_break_seconds
      else session.pomodoro_long_break_seconds
    end;
    update public.study_sessions
    set status = 'running',
        current_phase = p_phase,
        phase_started_at = now(),
        phase_ends_at = now() + phase_seconds * interval '1 second',
        phase_remaining_seconds = null
    where id = session.id
    returning * into session;
  elsif p_phase = 'focus' then
    if session.current_phase not in ('short_break', 'long_break') then
      raise exception '番茄状态不同步，请刷新页面重试';
    end if;
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
    raise exception '番茄阶段参数不正确';
  end if;
  return session;
end;
$$;

-- Skip a break: from "waiting" (right after focus) or mid-break, jump
-- straight into the next focus round.
create or replace function public.skip_pomodoro_break(p_session_id uuid)
returns public.study_sessions
language plpgsql
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  session public.study_sessions%rowtype;
begin
  if uid is null then
    raise exception '请先登录后再操作';
  end if;

  select * into session from public.study_sessions
  where id = p_session_id and user_id = uid
  for update;
  if not found then
    raise exception '学习会话不存在';
  end if;
  if session.mode <> 'pomodoro' then
    raise exception '仅番茄专注支持该操作';
  end if;
  if session.ended_at is not null then
    raise exception '番茄状态不同步，请刷新页面重试';
  end if;
  if not (
    (session.status = 'waiting' and session.current_phase = 'focus')
    or (session.status = 'running' and session.current_phase in ('short_break', 'long_break'))
  ) then
    raise exception '当前状态不能跳过休息';
  end if;

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
  return session;
end;
$$;

-- End the current focus round early without finishing the whole session:
-- the segment closes at now() (actual time counted, no round increment) and
-- the session waits for the user's break/next-round choice. An already
-- expired phase is caught up exactly like sync_pomodoro_session.
create or replace function public.end_current_focus_round(p_session_id uuid)
returns public.study_sessions
language plpgsql
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  session public.study_sessions%rowtype;
begin
  if uid is null then
    raise exception '请先登录后再操作';
  end if;

  select * into session from public.study_sessions
  where id = p_session_id and user_id = uid
  for update;
  if not found then
    raise exception '学习会话不存在';
  end if;
  if session.ended_at is not null then
    return session;
  end if;
  if session.mode <> 'pomodoro' or session.status <> 'running' or session.current_phase <> 'focus' then
    raise exception '当前状态不能提前结束本轮';
  end if;

  if session.phase_ends_at is not null and session.phase_ends_at <= now() then
    update public.study_session_segments
    set ended_at = session.phase_ends_at
    where session_id = session.id and ended_at is null;

    update public.study_sessions
    set status = 'waiting',
        phase_started_at = null,
        phase_ends_at = null,
        phase_remaining_seconds = null,
        pomodoro_completed_rounds = pomodoro_completed_rounds + 1
    where id = session.id
    returning * into session;
    return session;
  end if;

  update public.study_session_segments
  set ended_at = now()
  where session_id = session.id and ended_at is null;

  update public.study_sessions
  set status = 'waiting',
      phase_started_at = null,
      phase_ends_at = null,
      phase_remaining_seconds = null
  where id = session.id
  returning * into session;
  return session;
end;
$$;

-- Finish (or cancel) the session. Applies sync first so a phase that expired
-- while the page was closed still counts and closes at its planned end time.
-- Ends with "cancelled" when less than a minute was actually studied.
create or replace function public.finish_study_session(p_session_id uuid)
returns public.study_sessions
language plpgsql
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  session public.study_sessions%rowtype;
  studied_any boolean;
begin
  if uid is null then
    raise exception '请先登录后再操作';
  end if;

  select * into session from public.study_sessions
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

  select exists (
    select 1 from public.study_session_segments
    where session_id = session.id and ended_at - started_at >= interval '1 minute'
  ) into studied_any;

  update public.study_sessions
  set status = case when studied_any then 'completed' else 'cancelled' end,
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

-- ---------------------------------------------------------------------------
-- RPC grants: authenticated only
-- ---------------------------------------------------------------------------

revoke all on function
  public.haversine_distance_m(double precision, double precision, double precision, double precision),
  public.check_in_at_location(uuid, double precision, double precision, double precision),
  public.check_out_from_location(double precision, double precision, double precision),
  public.force_close_attendance(),
  public.start_study_session(text, uuid, integer, integer, integer, integer),
  public.pause_study_session(uuid),
  public.resume_study_session(uuid),
  public.sync_pomodoro_session(uuid),
  public.start_next_pomodoro_phase(uuid, text),
  public.skip_pomodoro_break(uuid),
  public.end_current_focus_round(uuid),
  public.finish_study_session(uuid)
from public, anon;

grant execute on function
  public.haversine_distance_m(double precision, double precision, double precision, double precision),
  public.check_in_at_location(uuid, double precision, double precision, double precision),
  public.check_out_from_location(double precision, double precision, double precision),
  public.force_close_attendance(),
  public.start_study_session(text, uuid, integer, integer, integer, integer),
  public.pause_study_session(uuid),
  public.resume_study_session(uuid),
  public.sync_pomodoro_session(uuid),
  public.start_next_pomodoro_phase(uuid, text),
  public.skip_pomodoro_break(uuid),
  public.end_current_focus_round(uuid),
  public.finish_study_session(uuid)
to authenticated;

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

-- V0.5.0: optional task duration goals and end-of-session reflections.
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
  if uid is null then raise exception '请先登录后再操作'; end if;
  if char_length(normalized) > 500 then raise exception '学习记录不能超过 500 个字符'; end if;

  update public.study_sessions
  set reflection = normalized
  where id = p_session_id and user_id = uid and ended_at is not null
  returning * into result;

  if not found then raise exception '只能为已结束的学习记录填写总结'; end if;
  return result;
end;
$$;

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
  if uid is null then raise exception '请先登录后再操作'; end if;
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
