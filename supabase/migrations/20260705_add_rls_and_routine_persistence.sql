-- Enable Row Level Security and authenticated-user policies for the fitness app.
-- Run this after the initial schema if you already created the original tables.

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.workout_logs enable row level security;
alter table public.set_logs enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Exercises are readable by authenticated users" on public.exercises;
create policy "Exercises are readable by authenticated users"
on public.exercises for select
to authenticated
using (true);

drop policy if exists "Authenticated users can create exercises" on public.exercises;
create policy "Authenticated users can create exercises"
on public.exercises for insert
to authenticated
with check (true);

drop policy if exists "Users can read own routines" on public.routines;
create policy "Users can read own routines"
on public.routines for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own routines" on public.routines;
create policy "Users can create own routines"
on public.routines for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own routines" on public.routines;
create policy "Users can update own routines"
on public.routines for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own routines" on public.routines;
create policy "Users can delete own routines"
on public.routines for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can read exercises from own routines" on public.routine_exercises;
create policy "Users can read exercises from own routines"
on public.routine_exercises for select
to authenticated
using (
  exists (
    select 1 from public.routines
    where routines.id = routine_exercises.routine_id
      and routines.user_id = auth.uid()
  )
);

drop policy if exists "Users can create exercises in own routines" on public.routine_exercises;
create policy "Users can create exercises in own routines"
on public.routine_exercises for insert
to authenticated
with check (
  exists (
    select 1 from public.routines
    where routines.id = routine_exercises.routine_id
      and routines.user_id = auth.uid()
  )
);

drop policy if exists "Users can manage exercises in own routines" on public.routine_exercises;
create policy "Users can manage exercises in own routines"
on public.routine_exercises for update
to authenticated
using (
  exists (
    select 1 from public.routines
    where routines.id = routine_exercises.routine_id
      and routines.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.routines
    where routines.id = routine_exercises.routine_id
      and routines.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete exercises in own routines" on public.routine_exercises;
create policy "Users can delete exercises in own routines"
on public.routine_exercises for delete
to authenticated
using (
  exists (
    select 1 from public.routines
    where routines.id = routine_exercises.routine_id
      and routines.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own workout logs" on public.workout_logs;
create policy "Users can read own workout logs"
on public.workout_logs for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own workout logs" on public.workout_logs;
create policy "Users can create own workout logs"
on public.workout_logs for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own workout logs" on public.workout_logs;
create policy "Users can update own workout logs"
on public.workout_logs for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can read own set logs" on public.set_logs;
create policy "Users can read own set logs"
on public.set_logs for select
to authenticated
using (
  exists (
    select 1 from public.workout_logs
    where workout_logs.id = set_logs.workout_log_id
      and workout_logs.user_id = auth.uid()
  )
);

drop policy if exists "Users can create own set logs" on public.set_logs;
create policy "Users can create own set logs"
on public.set_logs for insert
to authenticated
with check (
  exists (
    select 1 from public.workout_logs
    where workout_logs.id = set_logs.workout_log_id
      and workout_logs.user_id = auth.uid()
  )
);
