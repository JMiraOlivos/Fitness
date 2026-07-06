-- Body weight / measurements tracking (Fase 8 "features visibles"): no table existed
-- for this at all. One row per log entry, not one row per day, so a user can correct
-- a same-day entry by adding a new one rather than needing an upsert.

create table if not exists public.body_measurements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  recorded_at date not null default current_date,
  weight_kg numeric(5,2) not null,
  body_fat_percentage numeric(4,1),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists body_measurements_user_recorded_at_idx
on public.body_measurements (user_id, recorded_at desc);

alter table public.body_measurements enable row level security;

drop policy if exists "Users can read own body measurements" on public.body_measurements;
create policy "Users can read own body measurements"
on public.body_measurements for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own body measurements" on public.body_measurements;
create policy "Users can create own body measurements"
on public.body_measurements for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own body measurements" on public.body_measurements;
create policy "Users can update own body measurements"
on public.body_measurements for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own body measurements" on public.body_measurements;
create policy "Users can delete own body measurements"
on public.body_measurements for delete
to authenticated
using (auth.uid() = user_id);
