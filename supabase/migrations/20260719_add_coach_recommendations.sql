-- vNext+ P0-1 (ROADMAP.md): Coach IA proactivo — persistir las recomendaciones que
-- buildWeeklyRecommendations() genera de forma efímera para mostrarlas proactivamente
-- en el Home con badge de no leídas.

begin;

create table public.coach_recommendations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('volume_low', 'volume_high', 'fatigue', 'adherence', 'general')),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  message text not null,
  is_read boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.coach_recommendations enable row level security;

create policy "Users can read own recommendations"
on public.coach_recommendations for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create own recommendations"
on public.coach_recommendations for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own recommendations"
on public.coach_recommendations for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

commit;
