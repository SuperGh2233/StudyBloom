-- StudyBloom V0.6.0: optional daily study goal stored with study preferences.

alter table public.study_preferences
  add column if not exists daily_goal_enabled boolean not null default true,
  add column if not exists daily_goal_minutes integer not null default 120;

alter table public.study_preferences
  drop constraint if exists study_preferences_daily_goal_minutes_check;
alter table public.study_preferences
  add constraint study_preferences_daily_goal_minutes_check
  check (daily_goal_minutes between 1 and 1440);
