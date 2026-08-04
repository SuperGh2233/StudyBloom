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
