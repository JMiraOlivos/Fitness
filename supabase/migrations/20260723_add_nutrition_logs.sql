-- vNext++ U18 (ROADMAP.md): tracking mínimo de nutrición/hidratación diaria (agua,
-- proteína, calorías). Un registro por usuario y día (upsert on conflict), para
-- cerrar el círculo de coaching junto con peso corporal / body_measurements.

begin;

create table if not exists public.daily_nutrition_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null default (timezone('utc'::text, now())::date),
  water_ml integer check (water_ml is null or water_ml between 0 and 20000),
  protein_g numeric(5,1) check (protein_g is null or protein_g between 0 and 1000),
  calories integer check (calories is null or calories between 0 and 20000),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, log_date)
);

alter table public.daily_nutrition_logs enable row level security;

create policy "Users can read own nutrition"
on public.daily_nutrition_logs for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own nutrition"
on public.daily_nutrition_logs for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own nutrition"
on public.daily_nutrition_logs for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own nutrition"
on public.daily_nutrition_logs for delete
to authenticated
using (auth.uid() = user_id);

commit;
