-- StudyBloom V0.9.1: one privacy-preserving round trip for the home companion card.
-- The function returns a screen-specific projection. It never grants companions
-- direct access to raw sessions, segments, tasks, notes, or location data.

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
      ((d + 1)::timestamp at time zone 'Asia/Shanghai') as day_end
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
