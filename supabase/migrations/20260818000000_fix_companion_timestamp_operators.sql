-- StudyBloom v0.10.1: fix 42883 "operator does not exist: timestamp without
-- time zone + integer" in the companionship RPCs.
--
-- PostgreSQL has no `timestamp + integer` operator. `generate_series(date, date,
-- interval)` returns `setof timestamp`, so `d + 1` / `day + 1` fail at first
-- execution (plpgsql compiles bodies lazily). Replace with `+ interval '1 day'`.
--
-- Affected: get_companion_summary, get_companion_weekly_summary,
-- get_companion_home_state. Safe to re-run (create or replace).

-- ---------------------------------------------------------------------------
-- get_companion_summary
-- ---------------------------------------------------------------------------
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
      ((d + interval '1 day') at time zone 'Asia/Shanghai') as day_end
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

revoke all on function public.get_companion_summary(uuid, date, date) from public, anon;
grant execute on function public.get_companion_summary(uuid, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- get_companion_weekly_summary
-- ---------------------------------------------------------------------------
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
      sum(extract(epoch from least(coalesce(seg.ended_at, pg_catalog.now()), ((day + interval '1 day') at time zone 'Asia/Shanghai'))
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

revoke all on function public.get_companion_weekly_summary(uuid) from public, anon;
grant execute on function public.get_companion_weekly_summary(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_companion_home_state
-- ---------------------------------------------------------------------------
create or replace function public.get_companion_home_state()
returns table (
  has_friends boolean,
  primary_companion_id uuid,
  primary_companion_name text,
  experience_mode text,
  own_share_level text,
  companion_share_level text,
  today_date date,
  companion_effective_today boolean,
  companion_studied_minutes integer,
  companion_completed_tasks integer,
  companion_total_tasks integer,
  shared_bloom_dates date[],
  week_bloom_days integer,
  sent_today boolean,
  received_today boolean,
  generated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  uid uuid := auth.uid();
  today_cn date := (pg_catalog.timezone('Asia/Shanghai', pg_catalog.now()))::date;
  week_start date := date_trunc('week', pg_catalog.timezone('Asia/Shanghai', pg_catalog.now()))::date;
  v_has_friends boolean := false;
  v_primary_id uuid;
  v_primary_name text;
  v_mode text := 'study_together';
  v_own_level text := 'none';
  v_companion_level text := 'none';
  v_companion_seconds bigint := 0;
  v_completed_tasks integer;
  v_total_tasks integer;
  v_shared_dates date[] := '{}'::date[];
  v_week_days integer := 0;
  v_sent_today boolean := false;
  v_received_today boolean := false;
begin
  if uid is null then raise exception '需要登录后使用搭子功能'; end if;

  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and uid in (f.requester_id, f.addressee_id)
  ) into v_has_friends;

  select cp.primary_companion_id, cp.experience_mode
  into v_primary_id, v_mode
  from public.companion_preferences cp
  where cp.user_id = uid;

  if v_primary_id is not null and not exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = uid and f.addressee_id = v_primary_id)
        or (f.requester_id = v_primary_id and f.addressee_id = uid))
  ) then
    v_primary_id := null;
  end if;

  if v_primary_id is null then
    return query select
      v_has_friends, null::uuid, null::text, coalesce(v_mode, 'study_together'),
      'none'::text, 'none'::text, today_cn,
      null::boolean, null::integer, null::integer, null::integer,
      '{}'::date[], 0, false, false, pg_catalog.now();
    return;
  end if;

  select coalesce(nullif(trim(n.remark), ''), nullif(trim(p.display_name), ''), '学习搭子')
  into v_primary_name
  from public.profiles p
  left join public.friend_notes n on n.owner_id = uid and n.friend_id = p.id
  where p.id = v_primary_id;

  select coalesce(max(cs.share_level) filter (where cs.owner_id = uid), 'none'),
         coalesce(max(cs.share_level) filter (where cs.owner_id = v_primary_id), 'none')
  into v_own_level, v_companion_level
  from public.companion_settings cs
  where (cs.owner_id = uid and cs.companion_id = v_primary_id)
     or (cs.owner_id = v_primary_id and cs.companion_id = uid);

  with days as (
    select d::date as day,
      (d::timestamp at time zone 'Asia/Shanghai') as day_start,
      ((d + interval '1 day') at time zone 'Asia/Shanghai') as day_end
    from generate_series((today_cn - 6)::timestamp, today_cn::timestamp, interval '1 day') d
  ), people as (
    select uid as user_id union all select v_primary_id
  ), daily as (
    select people.user_id, days.day,
      coalesce(sum(extract(epoch from
        least(coalesce(seg.ended_at, pg_catalog.now()), days.day_end)
        - greatest(seg.started_at, days.day_start)
      )) filter (where seg.id is not null), 0)::bigint as seconds
    from people cross join days
    left join public.study_session_segments seg
      on seg.user_id = people.user_id
     and seg.started_at < days.day_end
     and coalesce(seg.ended_at, pg_catalog.now()) > days.day_start
    group by people.user_id, days.day
  ), paired as (
    select mine.day, mine.seconds as own_seconds, theirs.seconds as companion_seconds
    from daily mine
    join daily theirs on theirs.day = mine.day and theirs.user_id = v_primary_id
    where mine.user_id = uid
  )
  select
    coalesce(array_agg(day order by day) filter (
      where v_own_level <> 'none' and v_companion_level <> 'none'
        and own_seconds >= 600 and companion_seconds >= 600
    ), '{}'::date[]),
    count(*) filter (
      where v_own_level <> 'none' and v_companion_level <> 'none'
        and day between week_start and today_cn
        and own_seconds >= 600 and companion_seconds >= 600
    )::integer,
    coalesce(max(companion_seconds) filter (where day = today_cn), 0)::bigint
  into v_shared_dates, v_week_days, v_companion_seconds
  from paired;

  if v_companion_level = 'summary' then
    select count(*) filter (where t.completed)::integer, count(*)::integer
    into v_completed_tasks, v_total_tasks
    from public.tasks t
    where t.user_id = v_primary_id and t.plan_date = today_cn;
  end if;

  select exists (
    select 1 from public.companion_encouragements e
    where e.sender_id = uid and e.recipient_id = v_primary_id
      and e.sent_on = today_cn and e.kind = 'flower'
  ), exists (
    select 1 from public.companion_encouragements e
    where e.sender_id = v_primary_id and e.recipient_id = uid
      and e.sent_on = today_cn and e.kind = 'flower'
  ) into v_sent_today, v_received_today;

  return query select
    v_has_friends,
    v_primary_id,
    coalesce(v_primary_name, '学习搭子'),
    coalesce(v_mode, 'study_together'),
    v_own_level,
    v_companion_level,
    today_cn,
    case when v_companion_level = 'none' then null else v_companion_seconds >= 600 end,
    case when v_companion_level = 'summary' then floor(v_companion_seconds / 60.0)::integer else null end,
    case when v_companion_level = 'summary' then coalesce(v_completed_tasks, 0) else null end,
    case when v_companion_level = 'summary' then coalesce(v_total_tasks, 0) else null end,
    v_shared_dates,
    v_week_days,
    v_sent_today,
    v_received_today,
    pg_catalog.now();
end;
$$;

revoke all on function public.get_companion_home_state() from public, anon;
grant execute on function public.get_companion_home_state() to authenticated;
