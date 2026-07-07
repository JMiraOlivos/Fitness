-- P1-4 (ROADMAP.md vNext+): User feedback on AI quality — thumbs up/down so
-- prompts can be iterated with real data instead of just latency/error metrics.

begin;

alter table public.ai_generations
add column if not exists user_feedback text
check (user_feedback is null or user_feedback in ('thumbs_up', 'thumbs_down'));

-- Admins can read all generations for audit (vNext 18, deferred)
create policy "Admins can read all ai generations"
on public.ai_generations for select
to authenticated
using (
  exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_admin = true)
);

-- All authenticated users can write feedback on their own generations
create policy "Users can update own ai generations feedback"
on public.ai_generations for update
to authenticated
using (auth.uid() = user_id)
with check (
  -- Only the user_feedback column may change
  auth.uid() = user_id
);

commit;
