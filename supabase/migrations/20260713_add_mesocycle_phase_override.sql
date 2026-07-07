-- Fase vNext 8 (resto, ROADMAP.md): lets the client force a week to be treated as
-- deload even off the fixed N-week cadence, driven by real fatigue/adherence
-- signals (Fase vNext 7 — src/lib/training/mesocycle.ts, shouldSuggestAdaptiveDeload)
-- instead of only the schedule. is_deload_week keeps reflecting what was actually
-- requested for that week (same rationale as 20260710_add_mesociclos.sql: no
-- second derived state that can desync), it just gains an optional override.
--
-- Postgres identifies functions by argument-type signature: adding a parameter
-- requires dropping the old signature first, same reasoning as every prior
-- signature change in this repo (20260709, 20260710).

begin;

drop function if exists public.save_routine_with_exercises(text, text, jsonb, uuid, integer, integer);

create function public.save_routine_with_exercises(
  routine_title text,
  routine_description text,
  exercises_payload jsonb,
  p_program_id uuid default null,
  p_week_number integer default null,
  p_day_of_week integer default null,
  p_force_deload boolean default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_routine_id uuid;
  current_user_id uuid := auth.uid();
  v_deload_every_n_weeks integer;
  v_duration_weeks integer;
  v_is_deload boolean := false;
begin
  if current_user_id is null then
    raise exception 'Debe iniciar sesión para guardar rutinas.';
  end if;

  if routine_title is null or btrim(routine_title) = '' then
    raise exception 'El título de la rutina es obligatorio.';
  end if;

  if p_program_id is not null then
    select deload_every_n_weeks, duration_weeks into v_deload_every_n_weeks, v_duration_weeks
    from public.programs
    where id = p_program_id and user_id = current_user_id;

    if not found then
      raise exception 'Programa no encontrado o no pertenece al usuario actual.';
    end if;

    if p_week_number is null or p_week_number < 1 or p_week_number > v_duration_weeks then
      raise exception 'Número de semana inválido para este programa.';
    end if;

    v_is_deload := coalesce(p_force_deload, v_deload_every_n_weeks is not null and (p_week_number % v_deload_every_n_weeks = 0));
  end if;

  insert into public.routines (user_id, title, description, program_id, week_number, day_of_week, is_deload_week)
  values (
    current_user_id,
    btrim(routine_title),
    nullif(btrim(coalesce(routine_description, '')), ''),
    p_program_id,
    p_week_number,
    p_day_of_week,
    v_is_deload
  )
  returning id into new_routine_id;

  perform public._insert_routine_exercises(new_routine_id, exercises_payload);

  return new_routine_id;
end;
$$;

-- Unchanged mapping from 20260711_add_routine_exercise_prescription.sql, just
-- threading through the new forzarDescarga field.
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
    nullif(p_routine->>'diaSemana', '')::integer,
    (p_routine->>'forzarDescarga')::boolean
  );
end;
$$;

grant execute on function public.save_routine_with_exercises(text, text, jsonb, uuid, integer, integer, boolean) to authenticated;
grant execute on function public.save_ai_routine(jsonb) to authenticated;

commit;
