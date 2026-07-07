-- Fase vNext 3 (ROADMAP.md): readiness check-in before training (energy, sleep,
-- soreness, joint pain, available time) so the session can be adapted without
-- regenerating the whole routine with AI. workout_log_id is nullable so a
-- readiness log can outlive/precede the session it was taken for, but in
-- practice the app always attaches it once the workout log exists.

begin;

create table public.readiness_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  workout_log_id uuid references public.workout_logs(id) on delete cascade,
  energy integer check (energy between 1 and 5),
  sleep_quality integer check (sleep_quality between 1 and 5),
  soreness integer check (soreness between 1 and 5),
  joint_pain boolean not null default false,
  available_minutes integer,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.readiness_logs enable row level security;

create policy "Users can read own readiness logs"
on public.readiness_logs for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create own readiness logs"
on public.readiness_logs for insert
to authenticated
with check (auth.uid() = user_id);

commit;
