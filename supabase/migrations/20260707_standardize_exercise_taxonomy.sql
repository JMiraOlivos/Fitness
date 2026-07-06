-- Standardizes exercises.target_muscle and exercises.equipment to a fixed taxonomy
-- (mirrored in src/lib/exerciseTaxonomy.ts and the generar-rutina Gemini schema), so
-- volume-by-muscle-group aggregation (Fase 8 "features visibles") can rely on exact
-- matches instead of free text ("Pecho" vs "pecho" vs "Pectoral" never grouping
-- together reliably).
--
-- Canonical muscle groups: Pecho, Espalda, Hombro, Bíceps, Tríceps, Antebrazo,
-- Cuádriceps, Isquiotibiales, Glúteo, Pantorrilla, Core, Trapecio, General (fallback).
-- Canonical equipment: Polea, Barra, Máquina, Mancuerna, Corporal, Otro (fallback).
--
-- Existing free-text values are normalized via a synonym map before the CHECK
-- constraints are added. Anything unrecognized falls back to General/Otro, matching
-- the fallback values save_routine_with_exercises already used before this migration.
--
-- Normalizing text can make previously-distinct rows collide (e.g. "Dorsal" and
-- "Espalda" for the same exercise name both becoming "Espalda"), which would violate
-- the case-insensitive unique indexes from Fase 6. So: drop those indexes, normalize,
-- re-run the Fase 0 exercise-deduplication logic to merge any new collisions, then
-- recreate the indexes.

begin;

drop index if exists public.exercises_normalized_identity_global_idx;
drop index if exists public.exercises_normalized_identity_personal_idx;

update public.exercises
set target_muscle = case lower(btrim(target_muscle))
  when 'pecho' then 'Pecho'
  when 'pectoral' then 'Pecho'
  when 'pectorales' then 'Pecho'
  when 'espalda' then 'Espalda'
  when 'dorsal' then 'Espalda'
  when 'dorsales' then 'Espalda'
  when 'dorso' then 'Espalda'
  when 'hombro' then 'Hombro'
  when 'hombros' then 'Hombro'
  when 'deltoide' then 'Hombro'
  when 'deltoides' then 'Hombro'
  when 'biceps' then 'Bíceps'
  when 'bíceps' then 'Bíceps'
  when 'triceps' then 'Tríceps'
  when 'tríceps' then 'Tríceps'
  when 'antebrazo' then 'Antebrazo'
  when 'antebrazos' then 'Antebrazo'
  when 'cuadriceps' then 'Cuádriceps'
  when 'cuádriceps' then 'Cuádriceps'
  when 'cuadricep' then 'Cuádriceps'
  when 'pierna' then 'Cuádriceps'
  when 'piernas' then 'Cuádriceps'
  when 'isquios' then 'Isquiotibiales'
  when 'isquiotibial' then 'Isquiotibiales'
  when 'isquiotibiales' then 'Isquiotibiales'
  when 'femoral' then 'Isquiotibiales'
  when 'femorales' then 'Isquiotibiales'
  when 'gluteo' then 'Glúteo'
  when 'glúteo' then 'Glúteo'
  when 'gluteos' then 'Glúteo'
  when 'glúteos' then 'Glúteo'
  when 'pantorrilla' then 'Pantorrilla'
  when 'pantorrillas' then 'Pantorrilla'
  when 'gemelo' then 'Pantorrilla'
  when 'gemelos' then 'Pantorrilla'
  when 'core' then 'Core'
  when 'abdomen' then 'Core'
  when 'abdominales' then 'Core'
  when 'abs' then 'Core'
  when 'trapecio' then 'Trapecio'
  when 'trapecios' then 'Trapecio'
  when 'general' then 'General'
  else 'General'
end;

update public.exercises
set equipment = case lower(btrim(equipment))
  when 'polea' then 'Polea'
  when 'poleas' then 'Polea'
  when 'barra' then 'Barra'
  when 'barras' then 'Barra'
  when 'maquina' then 'Máquina'
  when 'máquina' then 'Máquina'
  when 'maquinas' then 'Máquina'
  when 'máquinas' then 'Máquina'
  when 'mancuerna' then 'Mancuerna'
  when 'mancuernas' then 'Mancuerna'
  when 'corporal' then 'Corporal'
  when 'peso corporal' then 'Corporal'
  when 'cuerpo' then 'Corporal'
  when 'otro' then 'Otro'
  when 'otros' then 'Otro'
  else 'Otro'
end;

-- Re-run the Fase 0 exercise-deduplication logic: repoint references to a canonical
-- row per normalized name/muscle/equipment, then delete the now-redundant duplicates.
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

alter table public.exercises
  drop constraint if exists exercises_target_muscle_check,
  add constraint exercises_target_muscle_check check (
    target_muscle in (
      'Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Antebrazo',
      'Cuádriceps', 'Isquiotibiales', 'Glúteo', 'Pantorrilla', 'Core', 'Trapecio', 'General'
    )
  );

alter table public.exercises
  drop constraint if exists exercises_equipment_check,
  add constraint exercises_equipment_check check (
    equipment in ('Polea', 'Barra', 'Máquina', 'Mancuerna', 'Corporal', 'Otro')
  );

-- Defensively normalize incoming muscle/equipment text the same way, so the RPC
-- stays correct even if a caller ever sends something outside the Gemini schema's enum.
create or replace function public.save_routine_with_exercises(
  routine_title text,
  routine_description text,
  exercises_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_routine_id uuid;
  exercise_payload jsonb;
  exercise_id uuid;
  exercise_name text;
  exercise_target_muscle text;
  exercise_equipment text;
  exercise_order integer := 0;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Debe iniciar sesión para guardar rutinas.';
  end if;

  if routine_title is null or btrim(routine_title) = '' then
    raise exception 'El título de la rutina es obligatorio.';
  end if;

  if exercises_payload is null or jsonb_typeof(exercises_payload) <> 'array' or jsonb_array_length(exercises_payload) = 0 then
    raise exception 'La rutina debe incluir al menos un ejercicio.';
  end if;

  insert into public.routines (user_id, title, description)
  values (current_user_id, btrim(routine_title), nullif(btrim(coalesce(routine_description, '')), ''))
  returning id into new_routine_id;

  for exercise_payload in select value from jsonb_array_elements(exercises_payload)
  loop
    exercise_order := exercise_order + 1;
    exercise_name := btrim(coalesce(exercise_payload->>'name', ''));
    exercise_target_muscle := case lower(btrim(coalesce(exercise_payload->>'targetMuscle', '')))
      when 'pecho' then 'Pecho'
      when 'pectoral' then 'Pecho'
      when 'pectorales' then 'Pecho'
      when 'espalda' then 'Espalda'
      when 'dorsal' then 'Espalda'
      when 'dorsales' then 'Espalda'
      when 'dorso' then 'Espalda'
      when 'hombro' then 'Hombro'
      when 'hombros' then 'Hombro'
      when 'deltoide' then 'Hombro'
      when 'deltoides' then 'Hombro'
      when 'biceps' then 'Bíceps'
      when 'bíceps' then 'Bíceps'
      when 'triceps' then 'Tríceps'
      when 'tríceps' then 'Tríceps'
      when 'antebrazo' then 'Antebrazo'
      when 'antebrazos' then 'Antebrazo'
      when 'cuadriceps' then 'Cuádriceps'
      when 'cuádriceps' then 'Cuádriceps'
      when 'cuadricep' then 'Cuádriceps'
      when 'pierna' then 'Cuádriceps'
      when 'piernas' then 'Cuádriceps'
      when 'isquios' then 'Isquiotibiales'
      when 'isquiotibial' then 'Isquiotibiales'
      when 'isquiotibiales' then 'Isquiotibiales'
      when 'femoral' then 'Isquiotibiales'
      when 'femorales' then 'Isquiotibiales'
      when 'gluteo' then 'Glúteo'
      when 'glúteo' then 'Glúteo'
      when 'gluteos' then 'Glúteo'
      when 'glúteos' then 'Glúteo'
      when 'pantorrilla' then 'Pantorrilla'
      when 'pantorrillas' then 'Pantorrilla'
      when 'gemelo' then 'Pantorrilla'
      when 'gemelos' then 'Pantorrilla'
      when 'core' then 'Core'
      when 'abdomen' then 'Core'
      when 'abdominales' then 'Core'
      when 'abs' then 'Core'
      when 'trapecio' then 'Trapecio'
      when 'trapecios' then 'Trapecio'
      when 'general' then 'General'
      else 'General'
    end;
    exercise_equipment := case lower(btrim(coalesce(exercise_payload->>'equipment', '')))
      when 'polea' then 'Polea'
      when 'poleas' then 'Polea'
      when 'barra' then 'Barra'
      when 'barras' then 'Barra'
      when 'maquina' then 'Máquina'
      when 'máquina' then 'Máquina'
      when 'maquinas' then 'Máquina'
      when 'máquinas' then 'Máquina'
      when 'mancuerna' then 'Mancuerna'
      when 'mancuernas' then 'Mancuerna'
      when 'corporal' then 'Corporal'
      when 'peso corporal' then 'Corporal'
      when 'cuerpo' then 'Corporal'
      when 'otro' then 'Otro'
      when 'otros' then 'Otro'
      else 'Otro'
    end;
    if exercise_name = '' then
      raise exception 'El ejercicio % no tiene nombre.', exercise_order;
    end if;

    select id into exercise_id
    from public.exercises
    where lower(btrim(name)) = lower(btrim(exercise_name))
      and lower(btrim(target_muscle)) = lower(btrim(exercise_target_muscle))
      and lower(btrim(equipment)) = lower(btrim(exercise_equipment))
      and owner_id is null
    limit 1;

    if exercise_id is null then
      begin
        insert into public.exercises (name, target_muscle, equipment)
        values (exercise_name, exercise_target_muscle, exercise_equipment)
        returning id into exercise_id;
      exception when unique_violation then
        select id into exercise_id
        from public.exercises
        where lower(btrim(name)) = lower(btrim(exercise_name))
          and lower(btrim(target_muscle)) = lower(btrim(exercise_target_muscle))
          and lower(btrim(equipment)) = lower(btrim(exercise_equipment))
          and owner_id is null
        limit 1;
      end;
    end if;

    if exercise_id is null then
      raise exception 'No se pudo crear o reutilizar el ejercicio %.', exercise_name;
    end if;

    insert into public.routine_exercises (
      routine_id,
      exercise_id,
      order_index,
      target_sets,
      target_reps,
      notes
    )
    values (
      new_routine_id,
      exercise_id,
      coalesce((exercise_payload->>'orderIndex')::integer, exercise_order),
      nullif(exercise_payload->>'targetSets', '')::integer,
      nullif(exercise_payload->>'targetReps', ''),
      nullif(exercise_payload->>'notes', '')
    );
  end loop;

  return new_routine_id;
end;
$$;

commit;
