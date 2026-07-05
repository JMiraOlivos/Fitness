-- Save a complete routine atomically from the client using Supabase RPC.
-- This avoids partially saved routines when an exercise or relation insert fails.
-- Requires 20260705_harden_exercise_deduplication.sql first.

begin;

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

-- Compatibility wrapper for the current dashboard payload shape.
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
      'notes', exercise_item->>'notas'
    )
  ), '[]'::jsonb)
  into exercises_payload
  from jsonb_array_elements(coalesce(p_routine->'ejercicios', '[]'::jsonb))
  with ordinality as payload(exercise_item, exercise_order);

  return public.save_routine_with_exercises(
    p_routine->>'titulo',
    p_routine->>'descripcion',
    exercises_payload
  );
end;
$$;

grant execute on function public.save_routine_with_exercises(text, text, jsonb) to authenticated;
grant execute on function public.save_ai_routine(jsonb) to authenticated;

commit;
