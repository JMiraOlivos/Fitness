create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  updated_at timestamp with time zone,
  full_name text,
  preferred_unit text default 'kg',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.exercises (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  target_muscle text not null,
  equipment text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.routines (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.routine_exercises (
  id uuid default gen_random_uuid() primary key,
  routine_id uuid references public.routines(id) on delete cascade not null,
  exercise_id uuid references public.exercises(id) on delete cascade not null,
  order_index integer not null,
  target_sets integer default 3,
  target_reps text default '10-12',
  notes text
);

create table public.workout_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  routine_id uuid references public.routines(id) on delete set null,
  start_time timestamp with time zone default timezone('utc'::text, now()) not null,
  end_time timestamp with time zone,
  ai_insight text
);

create table public.set_logs (
  id uuid default gen_random_uuid() primary key,
  workout_log_id uuid references public.workout_logs(id) on delete cascade not null,
  exercise_id uuid references public.exercises(id) on delete cascade not null,
  set_number integer not null,
  weight numeric(5,2) not null,
  reps integer not null,
  rpe integer check (rpe >= 1 and rpe <= 10),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
