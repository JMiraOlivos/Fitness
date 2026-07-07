-- Mesociclos (Fase 8, ítem diferido sin diseño previo): programas de entrenamiento
-- de varias semanas con semanas de deload programadas.
--
-- Cada rutina guardada ya es la unidad atómica "día" (ver 20260706_consolidate_save_routine_rpc.sql)
-- y nunca se comparte entre programas/semanas, así que en vez de una tabla puente
-- muchos-a-muchos se agregan columnas nullable directamente a `routines` — mismo
-- patrón que `training_goal` etc. en `profiles` (20260707_add_persistent_profile_fields.sql)
-- y `owner_id` en `exercises` (20260706_separate_global_and_personal_exercises.sql):
-- sin relleno no cambia nada, cero backfill, y workout_logs.routine_id (on delete
-- set null) y los flujos de borrar/regenerar día quedan intactos porque solo tocan
-- routine_id.
--
-- La semana "actual" de un programa no se guarda: se deriva como
-- max(week_number) entre las rutinas del programa, para no tener un segundo
-- estado que pueda desincronizarse.
--
-- Regla de deload v1: cadencia fija configurable por programa
-- (deload_every_n_weeks). is_deload_week se calcula y persiste en el momento de
-- guardar la rutina (no se recalcula al leer), porque es un hecho sobre lo que
-- efectivamente se le pidió a Gemini que generara ese día. Deload automático por
-- tendencia de RPE queda explícitamente diferido a una iteración futura.

begin;

create table if not exists public.programs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  focus text,
  duration_weeks integer not null check (duration_weeks between 1 and 16),
  days_per_week integer not null check (days_per_week between 1 and 7),
  deload_every_n_weeks integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.programs
  drop constraint if exists programs_deload_every_n_weeks_check,
  add constraint programs_deload_every_n_weeks_check check (
    deload_every_n_weeks is null or (deload_every_n_weeks between 2 and duration_weeks)
  );

alter table public.programs enable row level security;

drop policy if exists "Users can read own programs" on public.programs;
create policy "Users can read own programs"
on public.programs for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own programs" on public.programs;
create policy "Users can create own programs"
on public.programs for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own programs" on public.programs;
create policy "Users can update own programs"
on public.programs for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own programs" on public.programs;
create policy "Users can delete own programs"
on public.programs for delete
to authenticated
using (auth.uid() = user_id);

alter table public.routines
  add column if not exists program_id uuid references public.programs(id) on delete set null,
  add column if not exists week_number integer,
  add column if not exists day_of_week integer,
  add column if not exists is_deload_week boolean not null default false;

alter table public.routines
  drop constraint if exists routines_day_of_week_check,
  add constraint routines_day_of_week_check check (day_of_week is null or day_of_week between 1 and 7);

alter table public.routines
  drop constraint if exists routines_program_week_check,
  add constraint routines_program_week_check check (
    (program_id is null and week_number is null) or (program_id is not null and week_number is not null)
  );

create unique index if not exists routines_program_week_day_idx
on public.routines (program_id, week_number, day_of_week)
where program_id is not null;

-- Postgres identifica las funciones por su firma de tipos de argumento, no solo
-- por nombre: agregar 3 parámetros nuevos crearía una función sobrecargada
-- adicional en vez de reemplazar la de 3 argumentos si no se elimina primero
-- (mismo motivo por el que 20260709_regenerate_routine_day_rpc.sql hizo un drop
-- explícito antes de recrear con una firma distinta).
drop function if exists public.save_routine_with_exercises(text, text, jsonb);
drop function if exists public.save_routine_with_exercises(text, text, jsonb, uuid, integer, integer);

create function public.save_routine_with_exercises(
  routine_title text,
  routine_description text,
  exercises_payload jsonb,
  p_program_id uuid default null,
  p_week_number integer default null,
  p_day_of_week integer default null
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

    v_is_deload := v_deload_every_n_weeks is not null and (p_week_number % v_deload_every_n_weeks = 0);
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
    exercises_payload,
    nullif(p_routine->>'programaId', '')::uuid,
    nullif(p_routine->>'numeroSemana', '')::integer,
    nullif(p_routine->>'diaSemana', '')::integer
  );
end;
$$;

grant execute on function public.save_routine_with_exercises(text, text, jsonb, uuid, integer, integer) to authenticated;
grant execute on function public.save_ai_routine(jsonb) to authenticated;

commit;
