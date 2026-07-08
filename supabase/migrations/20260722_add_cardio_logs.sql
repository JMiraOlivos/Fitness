-- P3-12 (ROADMAP.md vNext+): Cardio y movilidad — registro de sesiones de
-- cardio (correr, bicicleta, natación, etc.) con métricas básicas.

begin;

create table public.cardio_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('running', 'cycling', 'walking', 'swimming', 'rowing', 'other')),
  duration_seconds integer not null check (duration_seconds > 0),
  distance_meters numeric(10,1),
  heart_rate_avg integer,
  calories integer,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.cardio_logs enable row level security;

create policy "Users can read own cardio"
on public.cardio_logs for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own cardio"
on public.cardio_logs for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete own cardio"
on public.cardio_logs for delete
to authenticated
using (auth.uid() = user_id);

commit;
