-- Transactional routine persistence for AI-generated routines.
-- This makes saving a routine atomic: routine, exercises and routine_exercises are committed together or rolled back together.
-- Run after 20260705_harden_exercise_deduplication.sql.

create or replace function public.save_ai_routine(p_routine jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_routine_id uuid;
  v_exercise_id uuid;
  v_item record;
  v_name text;
  v_target_muscle text;
  v_equipment text;
  v_title text;
  v_description text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_title := nullif(btrim(coalesce(p_routine->>'titulo', '')), '');
  v_description := nullif(btrim(coalesce(p_routine->>'descripcion', '')), '');

  if v_title is null then
    raise exception 'ROUTINE_TITLE_REQUIRED';
  end if;

  if jsonb_typeof(p_routine->'ejercicios') is distinct from 'array' then
    raise exception 'ROUTINE_EXERCISES_REQUIRED';
  end if;

  insert into public.routines (user_id, title, description)
  values (v_user_id, v_title, v_description)
  returning id into v_routine_id;

  for v_item in
    select value, ordinality
    from jsonb_array_elements(p_routine->'ejercicios') with ordinality
  loop
    v_name := nullif(regexp_replace(btrim(coalesce(v_item.value->>'nombre', '')), '\s+', ' ', 'g'), '');
    v_target_muscle := nullif(regexp_replace(btrim(coalesce(v_item.value->>'musculoObjetivo', '')), '\s+', ' ', 'g'), '');
    v_equipment := nullif(regexp_replace(btrim(coalesce(v_item.value->>'equipamiento', '')), '\s+', ' ', 'g'), '');

    if v_name is null then
      raise exception 'EXERCISE_NAME_REQUIRED';
    end if;

    v_target_muscle := coalesce(v_target_muscle, 'General');
    v_equipment := coalesce(v_equipment, 'Máquina');

    select id into v_exercise_id
    from public.exercises
    where lower(btrim(name)) = lower(v_name)
      and lower(btrim(target_muscle)) = lower(v_target_muscle)
      and lower(btrim(equipment)) = lower(v_equipment)
    order by id::text
    limit 1;

    if v_exercise_id is null then
      begin
        insert into public.exercises (name, target_muscle, equipment)
        values (v_name, v_target_muscle, v_equipment)
        returning id into v_exercise_id;
      exception when unique_violation then
        select id into v_exercise_id
        from public.exercises
        where lower(btrim(name)) = lower(v_name)
          and lower(btrim(target_muscle)) = lower(v_target_muscle)
          and lower(btrim(equipment)) = lower(v_equipment)
        order by id::text
        limit 1;
      end;
    end if;

    if v_exercise_id is null then
      raise exception 'EXERCISE_CREATE_FAILED';
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
      v_routine_id,
      v_exercise_id,
      v_item.ordinality::integer,
      nullif(v_item.value->>'seriesObjetivo', '')::integer,
      nullif(btrim(coalesce(v_item.value->>'repeticionesObjetivo', '')), ''),
      nullif(btrim(coalesce(v_item.value->>'notas', '')), '')
    );
  end loop;

  return v_routine_id;
end;
$$;

revoke all on function public.save_ai_routine(jsonb) from public;
grant execute on function public.save_ai_routine(jsonb) to authenticated;
