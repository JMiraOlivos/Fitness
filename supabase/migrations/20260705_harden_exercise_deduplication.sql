-- Harden exercise persistence by deduplicating existing rows and preventing future duplicates.
-- Run after 20260705_add_rls_and_routine_persistence.sql.

begin;

-- Repoint routine_exercises to a canonical exercise per normalized name/muscle/equipment.
with ranked_exercises as (
  select
    id,
    first_value(id) over (
      partition by lower(btrim(name)), lower(btrim(target_muscle)), lower(btrim(equipment))
      order by id::text
    ) as canonical_id
  from public.exercises
)
update public.routine_exercises re
set exercise_id = ranked_exercises.canonical_id
from ranked_exercises
where re.exercise_id = ranked_exercises.id
  and ranked_exercises.id <> ranked_exercises.canonical_id;

-- Repoint historical set_logs to the same canonical exercise.
with ranked_exercises as (
  select
    id,
    first_value(id) over (
      partition by lower(btrim(name)), lower(btrim(target_muscle)), lower(btrim(equipment))
      order by id::text
    ) as canonical_id
  from public.exercises
)
update public.set_logs sl
set exercise_id = ranked_exercises.canonical_id
from ranked_exercises
where sl.exercise_id = ranked_exercises.id
  and ranked_exercises.id <> ranked_exercises.canonical_id;

-- Delete duplicate exercise rows once references point to canonical rows.
with ranked_exercises as (
  select
    id,
    row_number() over (
      partition by lower(btrim(name)), lower(btrim(target_muscle)), lower(btrim(equipment))
      order by id::text
    ) as duplicate_rank
  from public.exercises
)
delete from public.exercises e
using ranked_exercises
where e.id = ranked_exercises.id
  and ranked_exercises.duplicate_rank > 1;

-- Enforce normalized uniqueness for future inserts.
create unique index if not exists exercises_normalized_identity_idx
on public.exercises (
  lower(btrim(name)),
  lower(btrim(target_muscle)),
  lower(btrim(equipment))
);

-- Add supporting indexes for the most common app queries.
create index if not exists routine_exercises_routine_id_idx
on public.routine_exercises (routine_id);

create index if not exists routine_exercises_exercise_id_idx
on public.routine_exercises (exercise_id);

create index if not exists workout_logs_user_start_time_idx
on public.workout_logs (user_id, start_time desc);

create index if not exists set_logs_workout_log_id_idx
on public.set_logs (workout_log_id);

create index if not exists set_logs_exercise_id_idx
on public.set_logs (exercise_id);

commit;
