-- Fase vNext 4, resto (ROADMAP.md): curated exercise catalog fields (canonical
-- name, aliases, movement pattern, difficulty, verified flag) plus a minimal
-- admin flag so /admin/exercises can exist without opening the shared global
-- catalog to any authenticated user. There is no admin concept anywhere else in
-- this app yet — profiles.is_admin defaults to false for everyone; the first
-- admin has to be flipped by hand (e.g. via the Supabase SQL editor), same as
-- any bootstrap-admin problem.

begin;

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

alter table public.exercises
  add column if not exists canonical_name text,
  add column if not exists aliases text[] not null default '{}',
  add column if not exists movement_pattern text,
  add column if not exists difficulty text,
  add column if not exists is_verified boolean not null default false;

alter table public.exercises
  drop constraint if exists exercises_movement_pattern_check,
  add constraint exercises_movement_pattern_check check (
    movement_pattern is null or movement_pattern in (
      'squat', 'hinge', 'horizontal_push', 'vertical_push',
      'horizontal_pull', 'vertical_pull', 'lunge', 'carry',
      'core', 'isolation', 'conditioning', 'mobility'
    )
  );

alter table public.exercises
  drop constraint if exists exercises_difficulty_check,
  add constraint exercises_difficulty_check check (
    difficulty is null or difficulty in ('beginner', 'intermediate', 'advanced')
  );

-- Only admins can edit the global catalog (owner_id is null); nobody could
-- update `exercises` at all before this (20260706_restrict_direct_exercise_inserts.sql
-- removed the last direct-write policy). Personal exercises still have no update
-- path — no feature creates them yet.
create policy "Admins can update global exercises"
on public.exercises for update
to authenticated
using (
  owner_id is null
  and exists (select 1 from public.profiles where id = auth.uid() and is_admin)
)
with check (
  owner_id is null
  and exists (select 1 from public.profiles where id = auth.uid() and is_admin)
);

commit;
