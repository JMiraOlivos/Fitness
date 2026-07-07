-- Fase vNext 4, resto (ROADMAP.md): matches an incoming exercise name against the
-- curated `aliases` array too, not just an exact case-insensitive name match.
-- This is what actually closes the "Press banca" vs "Press de banca" vs "Barbell
-- bench press" duplication gap — but only once an admin has curated aliases via
-- /admin/exercises (20260715_add_exercise_catalog_curation.sql); until then this
-- is a no-op superset of the existing exact-match behavior.

begin;

create or replace function public._insert_routine_exercises(
  target_routine_id uuid,
  exercises_payload jsonb
)
returns void
language plpgsql
set search_path = public
as $$
declare
  exercise_payload jsonb;
  exercise_id uuid;
  exercise_name text;
  exercise_target_muscle text;
  exercise_equipment text;
  exercise_order integer := 0;
begin
  if exercises_payload is null or jsonb_typeof(exercises_payload) <> 'array' or jsonb_array_length(exercises_payload) = 0 then
    raise exception 'La rutina debe incluir al menos un ejercicio.';
  end if;

  for exercise_payload in select value from jsonb_array_elements(exercises_payload)
  loop
    exercise_order := exercise_order + 1;
    exercise_name := btrim(coalesce(exercise_payload->>'name', ''));
    exercise_target_muscle := btrim(coalesce(exercise_payload->>'targetMuscle', ''));
    exercise_equipment := btrim(coalesce(exercise_payload->>'equipment', ''));

    if exercise_name = '' then
      raise exception 'El ejercicio % no tiene nombre.', exercise_order;
    end if;

    select id into exercise_id
    from public.exercises
    where (
        lower(btrim(name)) = lower(btrim(exercise_name))
        or lower(btrim(exercise_name)) = any(select lower(btrim(alias)) from unnest(aliases) as alias)
      )
      and lower(btrim(target_muscle)) = lower(btrim(exercise_target_muscle))
      and lower(btrim(equipment)) = lower(btrim(exercise_equipment))
    limit 1;

    if exercise_id is null then
      begin
        insert into public.exercises (name, target_muscle, equipment)
        values (exercise_name, exercise_target_muscle, exercise_equipment)
        returning id into exercise_id;
      exception when unique_violation then
        select id into exercise_id
        from public.exercises
        where (
            lower(btrim(name)) = lower(btrim(exercise_name))
            or lower(btrim(exercise_name)) = any(select lower(btrim(alias)) from unnest(aliases) as alias)
          )
          and lower(btrim(target_muscle)) = lower(btrim(exercise_target_muscle))
          and lower(btrim(equipment)) = lower(btrim(exercise_equipment))
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
      notes,
      rest_seconds,
      target_rpe,
      target_rir,
      tempo,
      movement_pattern,
      priority,
      progression_rule,
      substitution_criteria
    )
    values (
      target_routine_id,
      exercise_id,
      coalesce((exercise_payload->>'orderIndex')::integer, exercise_order),
      nullif(exercise_payload->>'targetSets', '')::integer,
      nullif(exercise_payload->>'targetReps', ''),
      nullif(exercise_payload->>'notes', ''),
      nullif(exercise_payload->>'restSeconds', '')::integer,
      nullif(exercise_payload->>'targetRpe', '')::numeric,
      nullif(exercise_payload->>'targetRir', '')::numeric,
      nullif(exercise_payload->>'tempo', ''),
      nullif(exercise_payload->>'movementPattern', ''),
      nullif(exercise_payload->>'priority', ''),
      nullif(exercise_payload->>'progressionRule', ''),
      nullif(exercise_payload->>'substitutionCriteria', '')
    );
  end loop;
end;
$$;

commit;
