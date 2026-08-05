-- Friend system: profiles, friendships, calendar_shares, plus read-only
-- friend access to tasks / plan_days. Owner write policies are untouched,
-- so friends can never insert, update or delete another user's data.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  friend_code text not null unique,
  avatar_url text,
  allow_requests boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Random 6-char hex suffix: ~16.7M combinations, not enumerable, not sequential.
create or replace function public.generate_friend_code()
returns text
language plpgsql
volatile
as $$
declare
  code text;
begin
  loop
    code := 'BLOOM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    if not exists (select 1 from public.profiles where friend_code = code) then
      return code;
    end if;
  end loop;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, friend_code)
  values (
    new.id,
    coalesce(
      nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), ''),
      split_part(new.email, '@', 1),
      'StudyBloom 用户'
    ),
    public.generate_friend_code()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill profiles for users created before the friend system.
insert into public.profiles (id, display_name, friend_code)
select
  u.id,
  coalesce(
    nullif(trim(coalesce(u.raw_user_meta_data->>'display_name', '')), ''),
    split_part(u.email, '@', 1),
    'StudyBloom 用户'
  ),
  public.generate_friend_code()
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ---------------------------------------------------------------------------
-- friendships
-- ---------------------------------------------------------------------------

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'rejected', 'blocked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);

create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);
create index if not exists friendships_status_idx on public.friendships (status);

-- One live relation per unordered pair; rejected rows allow a fresh request.
create unique index if not exists friendships_pair_active_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id))
  where status in ('pending', 'accepted', 'blocked');

-- ---------------------------------------------------------------------------
-- calendar_shares
-- ---------------------------------------------------------------------------

create table if not exists public.calendar_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  viewer_id uuid not null references auth.users (id) on delete cascade,
  can_view boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, viewer_id),
  check (owner_id <> viewer_id)
);

create index if not exists calendar_shares_owner_idx on public.calendar_shares (owner_id);
create index if not exists calendar_shares_viewer_idx on public.calendar_shares (viewer_id);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at + share cleanup when a friendship ends
-- ---------------------------------------------------------------------------

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists calendar_shares_set_updated_at on public.calendar_shares;
create trigger calendar_shares_set_updated_at
before update on public.calendar_shares
for each row execute function public.set_updated_at();

-- security definer so cleanup works no matter which side deletes the
-- friendship (share DELETE policies only allow the share owner).
create or replace function public.cleanup_calendar_shares()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE'
    or (tg_op = 'UPDATE' and old.status = 'accepted' and new.status <> 'accepted') then
    delete from public.calendar_shares
    where (owner_id = old.requester_id and viewer_id = old.addressee_id)
       or (owner_id = old.addressee_id and viewer_id = old.requester_id);
  end if;
  return null;
end;
$$;

drop trigger if exists friendships_cleanup_shares on public.friendships;
create trigger friendships_cleanup_shares
after update or delete on public.friendships
for each row execute function public.cleanup_calendar_shares();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, update on table public.profiles to authenticated;
revoke all on table public.profiles from anon;

grant select, insert, update, delete on table public.friendships to authenticated;
revoke all on table public.friendships from anon;

grant select, insert, update, delete on table public.calendar_shares to authenticated;
revoke all on table public.calendar_shares from anon;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.calendar_shares enable row level security;

-- profiles: public fields only (no email); only the owner edits their row.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
using (auth.uid() is not null);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- friendships: only the two people involved see the relation.
drop policy if exists friendships_select_own on public.friendships;
create policy friendships_select_own on public.friendships for select
using (auth.uid() in (requester_id, addressee_id));

-- Only as yourself, to someone who accepts requests; the pair index blocks
-- duplicate/blocked pairs server-side.
drop policy if exists friendships_insert_requester on public.friendships;
create policy friendships_insert_requester on public.friendships for insert
with check (
  auth.uid() = requester_id
  and requester_id <> addressee_id
  and exists (select 1 from public.profiles p where p.id = addressee_id and p.allow_requests)
);

-- Only the addressee answers a pending request.
drop policy if exists friendships_respond_addressee on public.friendships;
create policy friendships_respond_addressee on public.friendships for update
using (auth.uid() = addressee_id and status = 'pending')
with check (auth.uid() = addressee_id and status in ('accepted', 'rejected'));

-- Either side may block a pending or accepted relation.
drop policy if exists friendships_block_party on public.friendships;
create policy friendships_block_party on public.friendships for update
using (auth.uid() in (requester_id, addressee_id) and status in ('pending', 'accepted'))
with check (auth.uid() in (requester_id, addressee_id) and status = 'blocked');

-- Requester cancels their own pending request; either side removes an
-- accepted friendship. Rejected/blocked rows stay as history.
drop policy if exists friendships_delete_own on public.friendships;
create policy friendships_delete_own on public.friendships for delete
using (
  (auth.uid() = requester_id and status = 'pending')
  or (auth.uid() in (requester_id, addressee_id) and status = 'accepted')
);

-- calendar_shares: owner manages grants; the viewer can read their own grant.
drop policy if exists calendar_shares_select_party on public.calendar_shares;
create policy calendar_shares_select_party on public.calendar_shares for select
using (auth.uid() in (owner_id, viewer_id));

-- Only for accepted friendships; owner_id is pinned to the caller.
drop policy if exists calendar_shares_insert_owner on public.calendar_shares;
create policy calendar_shares_insert_owner on public.calendar_shares for insert
with check (
  auth.uid() = owner_id
  and owner_id <> viewer_id
  and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = owner_id and f.addressee_id = viewer_id)
        or (f.requester_id = viewer_id and f.addressee_id = owner_id)
      )
  )
);

drop policy if exists calendar_shares_update_owner on public.calendar_shares;
create policy calendar_shares_update_owner on public.calendar_shares for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists calendar_shares_delete_owner on public.calendar_shares;
create policy calendar_shares_delete_owner on public.calendar_shares for delete
using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Friend read access to tasks / plan_days (SELECT only).
-- Owner policies from the initial schema are left untouched, so a viewer can
-- never insert, update or delete the owner's rows.
-- ---------------------------------------------------------------------------

drop policy if exists tasks_select_shared on public.tasks;
create policy tasks_select_shared on public.tasks for select
using (
  exists (
    select 1 from public.calendar_shares cs
    where cs.owner_id = tasks.user_id
      and cs.viewer_id = auth.uid()
      and cs.can_view = true
  )
);

drop policy if exists plan_days_select_shared on public.plan_days;
create policy plan_days_select_shared on public.plan_days for select
using (
  exists (
    select 1 from public.calendar_shares cs
    where cs.owner_id = plan_days.user_id
      and cs.viewer_id = auth.uid()
      and cs.can_view = true
  )
);
