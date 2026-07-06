-- Lays the schema groundwork to distinguish global (curated, shared) exercises from
-- personal ones, per the Fase 6 roadmap item. No feature currently creates personal
-- exercises — save_ai_routine still only creates global rows (owner_id null) — so this
-- migration is behavior-preserving for the app as it exists today. It just makes room
-- for a future "add your own exercise" feature without a schema change at that point.
--
-- owner_id null = global/curated, visible to everyone (today's behavior for all rows).
-- owner_id set = personal, visible only to its owner.

begin;

alter table public.exercises
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

-- Replace the single global unique index with two partial ones, scoped by ownership.
-- A plain `unique (owner_id, name, muscle, equipment)` would silently stop deduplicating
-- global rows, because Postgres never considers NULL = NULL for uniqueness purposes.
drop index if exists public.exercises_normalized_identity_idx;

create unique index if not exists exercises_normalized_identity_global_idx
on public.exercises (
  lower(btrim(name)),
  lower(btrim(target_muscle)),
  lower(btrim(equipment))
)
where owner_id is null;

create unique index if not exists exercises_normalized_identity_personal_idx
on public.exercises (
  owner_id,
  lower(btrim(name)),
  lower(btrim(target_muscle)),
  lower(btrim(equipment))
)
where owner_id is not null;

drop policy if exists "Exercises are readable by authenticated users" on public.exercises;
create policy "Exercises are readable by authenticated users"
on public.exercises for select
to authenticated
using (owner_id is null or owner_id = auth.uid());

commit;
