-- Fase vNext 1 (ROADMAP.md): real prescription fields per routine exercise, so a
-- generated routine is actually trainable (rest, target RPE/RIR, tempo, movement
-- pattern, priority within the session, progression rule, substitution criteria)
-- instead of just sets/reps/notes. All columns are nullable so existing routines
-- keep working without backfill.

begin;

alter table public.routine_exercises
  add column if not exists rest_seconds integer,
  add column if not exists target_rpe numeric(3,1),
  add column if not exists target_rir numeric(3,1),
  add column if not exists tempo text,
  add column if not exists movement_pattern text,
  add column if not exists priority text,
  add column if not exists progression_rule text,
  add column if not exists substitution_criteria text;

alter table public.routine_exercises
  drop constraint if exists routine_exercises_target_rpe_check,
  add constraint routine_exercises_target_rpe_check
    check (target_rpe is null or target_rpe between 1 and 10),
  drop constraint if exists routine_exercises_target_rir_check,
  add constraint routine_exercises_target_rir_check
    check (target_rir is null or target_rir between 0 and 5),
  drop constraint if exists routine_exercises_rest_seconds_check,
  add constraint routine_exercises_rest_seconds_check
    check (rest_seconds is null or rest_seconds between 30 and 600),
  drop constraint if exists routine_exercises_priority_check,
  add constraint routine_exercises_priority_check
    check (priority is null or priority in ('principal', 'accesorio', 'aislamiento', 'correctivo')),
  drop constraint if exists routine_exercises_movement_pattern_check,
  add constraint routine_exercises_movement_pattern_check
    check (
      movement_pattern is null or movement_pattern in (
        'squat', 'hinge', 'horizontal_push', 'vertical_push',
        'horizontal_pull', 'vertical_pull', 'lunge', 'carry',
        'core', 'isolation', 'conditioning', 'mobility'
      )
    );

-- _insert_routine_exercises (20260709_regenerate_routine_day_rpc.sql) now reads the
-- 8 new optional keys from each exercise payload item. Signature is unchanged.
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
    where lower(btrim(name)) = lower(btrim(exercise_name))
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
        where lower(btrim(name)) = lower(btrim(exercise_name))
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

-- save_ai_routine / regenerate_ai_routine_day (Spanish-keyed Gemini payload wrappers)
-- now also map the 8 new prescription fields into the English-keyed payload that
-- _insert_routine_exercises expects. save_ai_routine keeps forwarding the mesociclos
-- programaId/numeroSemana/diaSemana fields (20260710_add_mesociclos.sql) to the
-- 6-argument save_routine_with_exercises — dropping those here would silently
-- de-link every AI-generated routine from its program.
create or replace function public.save_ai_routine(p_routine jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  exercises_payload jsonb;
begin
  if p_routine is null or jsonb_typeof(p_routine) <> 'object' then
    raise exception 'Payload de rutina inválido.';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'orderIndex', exercise_order,
      'name', btrim(coalesce(exercise_item->>'nombre', '')),
      'targetMuscle', btrim(coalesce(exercise_item->>'musculoObjetivo', '')),
      'equipment', btrim(coalesce(exercise_item->>'equipamiento', '')),
      'targetSets', exercise_item->>'seriesObjetivo',
      'targetReps', exercise_item->>'repeticionesObjetivo',
      'notes', exercise_item->>'notas',
      'restSeconds', exercise_item->>'descansoSegundos',
      'targetRpe', exercise_item->>'rpeObjetivo',
      'targetRir', exercise_item->>'rirObjetivo',
      'tempo', exercise_item->>'tempo',
      'movementPattern', exercise_item->>'patronMovimiento',
      'priority', exercise_item->>'prioridad',
      'progressionRule', exercise_item->>'reglaProgresion',
      'substitutionCriteria', exercise_item->>'criterioSustitucion'
    )
  ), '[]'::jsonb)
  into exercises_payload
  from jsonb_array_elements(coalesce(p_routine->'ejercicios', '[]'::jsonb))
  with ordinality as payload(exercise_item, exercise_order);

  return public.save_routine_with_exercises(
    p_routine->>'titulo',
    p_routine->>'descripcion',
    exercises_payload,
    nullif(p_routine->>'programaId', '')::uuid,
    nullif(p_routine->>'numeroSemana', '')::integer,
    nullif(p_routine->>'diaSemana', '')::integer
  );
end;
$$;

create or replace function public.regenerate_ai_routine_day(p_routine_id uuid, p_routine jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  exercises_payload jsonb;
begin
  if p_routine is null or jsonb_typeof(p_routine) <> 'object' then
    raise exception 'Payload de rutina inválido.';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'orderIndex', exercise_order,
      'name', btrim(coalesce(exercise_item->>'nombre', '')),
      'targetMuscle', btrim(coalesce(exercise_item->>'musculoObjetivo', '')),
      'equipment', btrim(coalesce(exercise_item->>'equipamiento', '')),
      'targetSets', exercise_item->>'seriesObjetivo',
      'targetReps', exercise_item->>'repeticionesObjetivo',
      'notes', exercise_item->>'notas',
      'restSeconds', exercise_item->>'descansoSegundos',
      'targetRpe', exercise_item->>'rpeObjetivo',
      'targetRir', exercise_item->>'rirObjetivo',
      'tempo', exercise_item->>'tempo',
      'movementPattern', exercise_item->>'patronMovimiento',
      'priority', exercise_item->>'prioridad',
      'progressionRule', exercise_item->>'reglaProgresion',
      'substitutionCriteria', exercise_item->>'criterioSustitucion'
    )
  ), '[]'::jsonb)
  into exercises_payload
  from jsonb_array_elements(coalesce(p_routine->'ejercicios', '[]'::jsonb))
  with ordinality as payload(exercise_item, exercise_order);

  perform public.regenerate_routine_day(
    p_routine_id,
    p_routine->>'titulo',
    p_routine->>'descripcion',
    exercises_payload
  );
end;
$$;

commit;
