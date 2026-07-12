-- vNext++ U13 + U11 + U16 (ROADMAP.md):
--   U13: supersets/dropsets — ejercicios que comparten superset_group se entrenan
--        como una superserie (A1/A2); set_style marca dropset/rest-pause/etc.
--   U11: logging coherente RPE/RIR — set_logs.rir permite registrar en RIR además
--        de RPE (la prescripción ya soportaba target_rir).
--   U16: tempo real (TUT) y unilateralidad — set_logs.tempo_seconds y side (both/
--        left/right) para registrar por lado y detectar asimetrías.
-- Todo nullable: rutinas y series existentes siguen válidas.

begin;

alter table public.routine_exercises
  add column if not exists superset_group integer,
  add column if not exists set_style text;

alter table public.routine_exercises
  drop constraint if exists routine_exercises_set_style_check,
  add constraint routine_exercises_set_style_check
    check (set_style is null or set_style in ('normal', 'dropset', 'rest_pause', 'myo_reps', 'amrap')),
  drop constraint if exists routine_exercises_superset_group_check,
  add constraint routine_exercises_superset_group_check
    check (superset_group is null or superset_group between 1 and 20);

alter table public.set_logs
  add column if not exists rir numeric(3,1),
  add column if not exists side text,
  add column if not exists tempo_seconds integer;

alter table public.set_logs
  drop constraint if exists set_logs_rir_check,
  add constraint set_logs_rir_check
    check (rir is null or rir between 0 and 5),
  drop constraint if exists set_logs_side_check,
  add constraint set_logs_side_check
    check (side is null or side in ('both', 'left', 'right')),
  drop constraint if exists set_logs_tempo_seconds_check,
  add constraint set_logs_tempo_seconds_check
    check (tempo_seconds is null or tempo_seconds between 1 and 600);

-- _insert_routine_exercises: extiende la versión con alias-matching (20260716) para
-- persistir también supersetGroup y setStyle. El resto de la lógica (matching por
-- alias, dedup, inserción de los 8 campos de prescripción) es idéntica.
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
      substitution_criteria,
      superset_group,
      set_style
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
      nullif(exercise_payload->>'substitutionCriteria', ''),
      nullif(exercise_payload->>'supersetGroup', '')::integer,
      nullif(exercise_payload->>'setStyle', '')
    );
  end loop;
end;
$$;

-- save_ai_routine / regenerate_ai_routine_day: mapean las claves nuevas en español
-- (grupoSuperserie, estiloSerie) además de las ya existentes. Conservan la firma
-- completa: forwarding de programaId/numeroSemana/diaSemana/forzarDescarga.
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
      'substitutionCriteria', exercise_item->>'criterioSustitucion',
      'supersetGroup', exercise_item->>'grupoSuperserie',
      'setStyle', exercise_item->>'estiloSerie'
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
    nullif(p_routine->>'diaSemana', '')::integer,
    (p_routine->>'forzarDescarga')::boolean
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
      'substitutionCriteria', exercise_item->>'criterioSustitucion',
      'supersetGroup', exercise_item->>'grupoSuperserie',
      'setStyle', exercise_item->>'estiloSerie'
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
