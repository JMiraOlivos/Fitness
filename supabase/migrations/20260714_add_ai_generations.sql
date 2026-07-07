-- Fase vNext 10 (ROADMAP.md): traceability for AI-generated content — model,
-- prompt/schema version, input/output, latency, success/error — so a bad prompt
-- can be identified and compared against prior versions. Only the 3 AI routes
-- that exist today are valid `type` values; extend the CHECK when new ones ship
-- (program_week_generation, exercise_substitution, coach_recommendation).

begin;

create table public.ai_generations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in ('routine_generation', 'routine_regeneration', 'workout_insight')),
  model text not null,
  prompt_version text not null,
  schema_version text not null,
  input jsonb,
  output jsonb,
  latency_ms integer,
  success boolean not null default false,
  error text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.ai_generations enable row level security;

create policy "Users can read own ai generations"
on public.ai_generations for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create own ai generations"
on public.ai_generations for insert
to authenticated
with check (auth.uid() = user_id);

commit;
