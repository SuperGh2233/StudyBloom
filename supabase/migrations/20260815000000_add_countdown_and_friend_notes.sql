-- StudyBloom V0.7.0: one personal countdown and private friend remarks.

alter table public.study_preferences
  add column if not exists countdown_enabled boolean not null default false,
  add column if not exists countdown_title text not null default '考研初试',
  add column if not exists countdown_date date;

alter table public.study_preferences
  drop constraint if exists study_preferences_countdown_title_check;
alter table public.study_preferences
  add constraint study_preferences_countdown_title_check
  check (char_length(trim(countdown_title)) between 1 and 30);

alter table public.study_preferences
  drop constraint if exists study_preferences_countdown_date_check;
alter table public.study_preferences
  add constraint study_preferences_countdown_date_check
  check (not countdown_enabled or countdown_date is not null);

create table if not exists public.friend_notes (
  owner_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  remark text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  check (owner_id <> friend_id),
  check (char_length(trim(remark)) between 1 and 30)
);

drop trigger if exists friend_notes_set_updated_at on public.friend_notes;
create trigger friend_notes_set_updated_at
before update on public.friend_notes
for each row execute function public.set_updated_at();

create or replace function public.cleanup_friend_notes()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE'
    or (tg_op = 'UPDATE' and old.status = 'accepted' and new.status <> 'accepted') then
    delete from public.friend_notes
    where (owner_id = old.requester_id and friend_id = old.addressee_id)
       or (owner_id = old.addressee_id and friend_id = old.requester_id);
  end if;
  return null;
end;
$$;

drop trigger if exists friendships_cleanup_notes on public.friendships;
create trigger friendships_cleanup_notes
after update or delete on public.friendships
for each row execute function public.cleanup_friend_notes();

grant select, insert, update, delete on table public.friend_notes to authenticated;
revoke all on table public.friend_notes from anon;
alter table public.friend_notes enable row level security;

drop policy if exists friend_notes_select_own on public.friend_notes;
create policy friend_notes_select_own on public.friend_notes for select
using (auth.uid() = owner_id);

drop policy if exists friend_notes_insert_own_friend on public.friend_notes;
create policy friend_notes_insert_own_friend on public.friend_notes for insert
with check (
  auth.uid() = owner_id
  and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = owner_id and f.addressee_id = friend_id)
        or (f.requester_id = friend_id and f.addressee_id = owner_id))
  )
);

drop policy if exists friend_notes_update_own_friend on public.friend_notes;
create policy friend_notes_update_own_friend on public.friend_notes for update
using (auth.uid() = owner_id)
with check (
  auth.uid() = owner_id
  and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = owner_id and f.addressee_id = friend_id)
        or (f.requester_id = friend_id and f.addressee_id = owner_id))
  )
);

drop policy if exists friend_notes_delete_own on public.friend_notes;
create policy friend_notes_delete_own on public.friend_notes for delete
using (auth.uid() = owner_id);
