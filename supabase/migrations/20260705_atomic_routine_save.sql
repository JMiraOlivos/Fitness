-- Atomic routine persistence.
-- Saves a routine, deduplicates exercises, and creates routine_exercises in one database transaction.

create or replace function public.save_routine_with_exercises(
  p_title text,
  p_description text,
  p_exercises jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_routine_id uuid;
  v_exercise_id uuid;
  v_exercise jsonb;
  v_index integer := 0;
  v_name text;
  v_target_muscle text;
  v_equipment text;
  v_target_sets integer;
  v_target_reps text;
  v_notes text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'User must be authenticated';
  end if;

  if p_title is null or btrim(p_title) = '' then
    raise exception 'Routine title is required';
  end if;

  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) = 0 then
    raise exception 'At least one exercise is required';
  end if;

  insert into public.routines (user_id, title, description)
  values (v_user_id, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''))
  returning id into v_routine_id;

  for v_exercise in select value from jsonb_array_elements(p_exercises)
  loop
    v_index := v_index + 1;
    v_name := btrim(coalesce(v_exercise->>'nombre', v_exercise->>'name', ''));
    v_target_muscle := btrim(coalesce(v_exercise->>'musculoObjetivo', v_exercise->>'target_muscle', ''));
    v_equipment := btrim(coalesce(v_exercise->>'equipamiento', v_exercise->>'equipment', ''));
    v_target_sets := coalesce(nullif(v_exercise->>'seriesObjetivo', '')::integer, 3);
    v_target_reps := nullif(btrim(coalesce(v_exercise->>'repeticionesObjetivo', v_exercise->>'target_reps', '')), '');
    v_notes := nullif(btrim(coalesce(v_exercise->>'notas', v_exercise->>'notes', '')), '');

    if v_name = '' then
      raise exception 'Exercise name is required at position %', v_index;
    end if;

    if v_target_muscle = '' then
      v_target_muscle := 'General';
    end if;

    if v_equipment = '' then
      v_equipment := 'Otro';
    end if;

    select id into v_exercise_id
    from public.exercises
    where lower(btrim(name)) = lower(v_name)
      and lower(btrim(target_muscle)) = lower(v_target_muscle)
      and lower(btrim(equipment)) = lower(v_equipment)
    limit 1;

    if v_exercise_id is null then
      insert into public.exercises (name, target_muscle, equipment)
      values (v_name, v_target_muscle, v_equipment)
      on conflict on constraint exercises_normalized_identity_idx do nothing
      returning id into v_exercise_id;

      if v_exercise_id is null then
        select id into v_exercise_id
        from public.exercises
        where lower(btrim(name)) = lower(v_name)
          and lower(btrim(target_muscle)) = lower(v_target_muscle)
          and lower(btrim(equipment)) = lower(v_equipment)
        limit 1;
      end if;
    end if;

    if v_exercise_id is null then
      raise exception 'Could not resolve exercise %', v_name;
    end if;

    insert into public.routine_exercises (
      routine_id,
      exercise_id,
      order_index,
      target_sets,
      target_reps,
      notes
    ) values (
      v_routine_id,
      v_exercise_id,
      v_index,
      v_target_sets,
      v_target_reps,
      v_notes
    );
  end loop;

  return v_routine_id;
end;
$$;

grant execute on function public.save_routine_with_exercises(text, text, jsonb) to authenticated;
