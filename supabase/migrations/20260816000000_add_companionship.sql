-- StudyBloom V0.9.0: private, asynchronous companionship.
-- Raw study sessions remain owner-only. Companions receive only the
-- explicitly authorised aggregate returned by get_companion_summary().

create table if not exists public.companion_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  primary_companion_id uuid references auth.users (id) on delete set null,
  experience_mode text not null default 'study_together'
    check (experience_mode in ('study_together', 'supporter')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (primary_companion_id is null or primary_companion_id <> user_id)
);

create table if not exists public.companion_settings (
  owner_id uuid not null references auth.users (id) on delete cascade,
  companion_id uuid not null references auth.users (id) on delete cascade,
  share_level text not null default 'none'
    check (share_level in ('none', 'bloom_only', 'summary')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, companion_id),
  check (owner_id <> companion_id)
);

create table if not exists public.companion_encouragements (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  sent_on date not null,
  kind text not null default 'flower' check (kind = 'flower'),
  created_at timestamptz not null default now(),
  unique (sender_id, recipient_id, sent_on, kind),
  check (sender_id <> recipient_id)
);

create index if not exists companion_preferences_primary_idx
  on public.companion_preferences (primary_companion_id)
  where primary_companion_id is not null;
create index if not exists companion_settings_companion_idx
  on public.companion_settings (companion_id);
create index if not exists companion_encouragements_recipient_date_idx
  on public.companion_encouragements (recipient_id, sent_on desc);

drop trigger if exists companion_preferences_set_updated_at on public.companion_preferences;
create trigger companion_preferences_set_updated_at
before update on public.companion_preferences
for each row execute function public.set_updated_at();

drop trigger if exists companion_settings_set_updated_at on public.companion_settings;
create trigger companion_settings_set_updated_at
before update on public.companion_settings
for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.companion_preferences to authenticated;
grant select, insert, update, delete on table public.companion_settings to authenticated;
grant select on table public.companion_encouragements to authenticated;
revoke all on table public.companion_preferences, public.companion_settings, public.companion_encouragements from anon;
revoke insert, update, delete on table public.companion_encouragements from authenticated;

alter table public.companion_preferences enable row level security;
alter table public.companion_settings enable row level security;
alter table public.companion_encouragements enable row level security;

drop policy if exists companion_preferences_select_own on public.companion_preferences;
create policy companion_preferences_select_own on public.companion_preferences for select
using (auth.uid() = user_id);

drop policy if exists companion_preferences_insert_own on public.companion_preferences;
create policy companion_preferences_insert_own on public.companion_preferences for insert
with check (
  auth.uid() = user_id
  and (
    primary_companion_id is null
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = user_id and f.addressee_id = primary_companion_id)
          or (f.requester_id = primary_companion_id and f.addressee_id = user_id))
    )
  )
);

drop policy if exists companion_preferences_update_own on public.companion_preferences;
create policy companion_preferences_update_own on public.companion_preferences for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    primary_companion_id is null
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = user_id and f.addressee_id = primary_companion_id)
          or (f.requester_id = primary_companion_id and f.addressee_id = user_id))
    )
  )
);

drop policy if exists companion_preferences_delete_own on public.companion_preferences;
create policy companion_preferences_delete_own on public.companion_preferences for delete
using (auth.uid() = user_id);

drop policy if exists companion_settings_select_party on public.companion_settings;
create policy companion_settings_select_party on public.companion_settings for select
using (auth.uid() in (owner_id, companion_id));

drop policy if exists companion_settings_insert_owner on public.companion_settings;
create policy companion_settings_insert_owner on public.companion_settings for insert
with check (
  auth.uid() = owner_id
  and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = owner_id and f.addressee_id = companion_id)
        or (f.requester_id = companion_id and f.addressee_id = owner_id))
  )
);

drop policy if exists companion_settings_update_owner on public.companion_settings;
create policy companion_settings_update_owner on public.companion_settings for update
using (auth.uid() = owner_id)
with check (
  auth.uid() = owner_id
  and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = owner_id and f.addressee_id = companion_id)
        or (f.requester_id = companion_id and f.addressee_id = owner_id))
  )
);

drop policy if exists companion_settings_delete_owner on public.companion_settings;
create policy companion_settings_delete_owner on public.companion_settings for delete
using (auth.uid() = owner_id);

drop policy if exists companion_encouragements_select_party on public.companion_encouragements;
create policy companion_encouragements_select_party on public.companion_encouragements for select
using (auth.uid() in (sender_id, recipient_id));

create or replace function public.cleanup_companionship()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE'
    or (tg_op = 'UPDATE' and old.status = 'accepted' and new.status <> 'accepted') then
    delete from public.companion_settings
    where (owner_id = old.requester_id and companion_id = old.addressee_id)
       or (owner_id = old.addressee_id and companion_id = old.requester_id);
    delete from public.companion_encouragements
    where (sender_id = old.requester_id and recipient_id = old.addressee_id)
       or (sender_id = old.addressee_id and recipient_id = old.requester_id);
    update public.companion_preferences
    set primary_companion_id = null
    where (user_id = old.requester_id and primary_companion_id = old.addressee_id)
       or (user_id = old.addressee_id and primary_companion_id = old.requester_id);
  end if;
  return null;
end;
$$;

drop trigger if exists friendships_cleanup_companionship on public.friendships;
create trigger friendships_cleanup_companionship
after update or delete on public.friendships
for each row execute function public.cleanup_companionship();

create or replace function public.get_companion_summary(
  p_target_user_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  summary_date date,
  effective_study boolean,
  studied_minutes integer,
  completed_tasks integer,
  total_tasks integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  uid uuid := auth.uid();
  access_level text;
  today_cn date := (pg_catalog.timezone('Asia/Shanghai', pg_catalog.now()))::date;
begin
  if uid is null then raise exception '需要登录后使用搭子功能'; end if;
  if p_target_user_id is null or p_target_user_id = uid then raise exception '搭子参数不正确'; end if;
  if p_start_date is null or p_end_date is null or p_start_date > p_end_date
    or p_end_date > today_cn or p_start_date < today_cn - 6
    or p_end_date - p_start_date > 6 then
    raise exception '搭子概要最多读取最近七天';
  end if;
  if not exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = uid and f.addressee_id = p_target_user_id)
        or (f.requester_id = p_target_user_id and f.addressee_id = uid))
  ) then raise exception '好友关系不存在或已失效'; end if;

  select cs.share_level into access_level
  from public.companion_settings cs
  where cs.owner_id = p_target_user_id and cs.companion_id = uid;
  if coalesce(access_level, 'none') = 'none' then return; end if;

  return query
  with days as (
    select d::date as day,
      (d::timestamp at time zone 'Asia/Shanghai') as day_start,
      ((d + 1)::timestamp at time zone 'Asia/Shanghai') as day_end
    from generate_series(p_start_date, p_end_date, interval '1 day') d
  ), totals as (
    select days.day,
      coalesce((
        select sum(extract(epoch from
          least(coalesce(seg.ended_at, pg_catalog.now()), days.day_end)
          - greatest(seg.started_at, days.day_start)))
        from public.study_session_segments seg
        where seg.user_id = p_target_user_id
          and seg.started_at < days.day_end
          and coalesce(seg.ended_at, pg_catalog.now()) > days.day_start
      ), 0)::bigint as seconds,
      (select count(*)::integer from public.tasks t
        where t.user_id = p_target_user_id and t.plan_date = days.day) as task_total,
      (select count(*)::integer from public.tasks t
        where t.user_id = p_target_user_id and t.plan_date = days.day and t.completed) as task_completed
    from days
  )
  select totals.day,
    totals.seconds >= 600,
    case when access_level = 'summary' then floor(totals.seconds / 60.0)::integer else null end,
    case when access_level = 'summary' then totals.task_completed else null end,
    case when access_level = 'summary' then totals.task_total else null end
  from totals order by totals.day;
end;
$$;

create or replace function public.get_companion_weekly_summary(p_target_user_id uuid)
returns table (
  week_bloom_days integer,
  total_bloom_days integer,
  week_mutual_flower_days integer,
  milestone integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  uid uuid := auth.uid();
  today_cn date := (pg_catalog.timezone('Asia/Shanghai', pg_catalog.now()))::date;
  week_start date := date_trunc('week', pg_catalog.timezone('Asia/Shanghai', pg_catalog.now()))::date;
  my_level text;
  their_level text;
begin
  if uid is null then raise exception '需要登录后使用搭子功能'; end if;
  if not exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = uid and f.addressee_id = p_target_user_id)
        or (f.requester_id = p_target_user_id and f.addressee_id = uid))
  ) then raise exception '好友关系不存在或已失效'; end if;
  select share_level into my_level from public.companion_settings where owner_id = uid and companion_id = p_target_user_id;
  select share_level into their_level from public.companion_settings where owner_id = p_target_user_id and companion_id = uid;
  if coalesce(my_level, 'none') = 'none' or coalesce(their_level, 'none') = 'none' then return; end if;

  return query
  with people as (select uid as user_id union all select p_target_user_id),
  daily as (
    select seg.user_id, day::date as study_date,
      sum(extract(epoch from least(coalesce(seg.ended_at, pg_catalog.now()), ((day + 1)::timestamp at time zone 'Asia/Shanghai'))
        - greatest(seg.started_at, (day::timestamp at time zone 'Asia/Shanghai')))) as seconds
    from public.study_session_segments seg
    join people p on p.user_id = seg.user_id
    cross join lateral generate_series(
      (pg_catalog.timezone('Asia/Shanghai', seg.started_at))::date,
      (pg_catalog.timezone('Asia/Shanghai', coalesce(seg.ended_at, pg_catalog.now())))::date,
      interval '1 day'
    ) day
    group by seg.user_id, day::date
  ), blooms as (
    select mine.study_date
    from daily mine
    join daily theirs on theirs.study_date = mine.study_date and theirs.user_id = p_target_user_id and theirs.seconds >= 600
    where mine.user_id = uid and mine.seconds >= 600 and mine.study_date <= today_cn
  ), aggregate_values as (
    select
      count(*) filter (where study_date between week_start and today_cn)::integer as current_week,
      count(*)::integer as total
    from blooms
  ), mutual_flowers as (
    select count(distinct sent_on)::integer as current_week
    from public.companion_encouragements mine
    where mine.sender_id = uid and mine.recipient_id = p_target_user_id
      and mine.sent_on between week_start and today_cn
      and exists (
        select 1 from public.companion_encouragements theirs
        where theirs.sender_id = p_target_user_id and theirs.recipient_id = uid
          and theirs.sent_on = mine.sent_on and theirs.kind = 'flower'
      )
  )
  select a.current_week, a.total, f.current_week,
    case when a.total >= 100 then 100 when a.total >= 50 then 50 when a.total >= 30 then 30 when a.total >= 10 then 10 else null end
  from aggregate_values a cross join mutual_flowers f;
end;
$$;

create or replace function public.send_companion_flower(p_recipient_id uuid)
returns public.companion_encouragements
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  uid uuid := auth.uid();
  result public.companion_encouragements%rowtype;
  today_cn date := (pg_catalog.timezone('Asia/Shanghai', pg_catalog.now()))::date;
begin
  if uid is null then raise exception '需要登录后送花'; end if;
  if p_recipient_id is null or p_recipient_id = uid then raise exception '搭子参数不正确'; end if;
  if not exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = uid and f.addressee_id = p_recipient_id)
        or (f.requester_id = p_recipient_id and f.addressee_id = uid))
  ) then raise exception '只有好友之间可以送花'; end if;

  insert into public.companion_encouragements (sender_id, recipient_id, sent_on, kind)
  values (uid, p_recipient_id, today_cn, 'flower')
  on conflict (sender_id, recipient_id, sent_on, kind)
  do update set sender_id = excluded.sender_id
  returning * into result;
  return result;
end;
$$;

revoke all on function public.get_companion_summary(uuid, date, date) from public, anon;
revoke all on function public.get_companion_weekly_summary(uuid) from public, anon;
revoke all on function public.send_companion_flower(uuid) from public, anon;
grant execute on function public.get_companion_summary(uuid, date, date) to authenticated;
grant execute on function public.get_companion_weekly_summary(uuid) to authenticated;
grant execute on function public.send_companion_flower(uuid) to authenticated;

