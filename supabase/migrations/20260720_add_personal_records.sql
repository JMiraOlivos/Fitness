-- P1-3 (ROADMAP.md vNext+): Personal Records tracking — cada vez que un usuario
-- rompe su mejor marca histórica en peso, reps, volumen o 1RM estimado para un
-- ejercicio, se registra como PR para celebrarlo durante la sesión y mostrarlo
-- en el historial de progreso.

begin;

create table public.personal_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  metric_type text not null check (metric_type in ('weight', 'reps', 'volume', 'one_rep_max')),
  value numeric(12,2) not null,
  workout_log_id uuid not null references public.workout_logs(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.personal_records enable row level security;

create policy "Users can read own PRs"
on public.personal_records for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own PRs"
on public.personal_records for insert
to authenticated
with check (auth.uid() = user_id);

commit;
