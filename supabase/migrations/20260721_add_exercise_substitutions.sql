-- P2-6 (ROADMAP.md vNext+): Exercise substitution audit log — cuando un
-- usuario sustituye un ejercicio en plena sesión, este registro preserva el
-- historial de qué ejercicio fue reemplazado por cuál, en vez de perder el dato
-- con un simple UPDATE de routine_exercises.exercise_id.

begin;

create table public.exercise_substitutions (
  id uuid default gen_random_uuid() primary key,
  routine_exercise_id uuid not null references public.routine_exercises(id) on delete cascade,
  from_exercise_id uuid not null references public.exercises(id) on delete cascade,
  to_exercise_id uuid not null references public.exercises(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_log_id uuid references public.workout_logs(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.exercise_substitutions enable row level security;

create policy "Users can read own substitutions"
on public.exercise_substitutions for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own substitutions"
on public.exercise_substitutions for insert
to authenticated
with check (auth.uid() = user_id);

commit;
