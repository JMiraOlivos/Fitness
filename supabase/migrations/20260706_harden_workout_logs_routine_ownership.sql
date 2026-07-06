-- RLS edge case: the insert/update policies on workout_logs only checked
-- `auth.uid() = user_id`, never that `routine_id` (when set) actually belongs to
-- that same user. A client could bypass the UI and directly call
-- `supabase.from('workout_logs').insert/update({ user_id: me, routine_id: <someone
-- else's routine id> })`. This doesn't leak the other routine's data (routines and
-- routine_exercises stay scoped to their owner via their own RLS), but it lets a
-- user misattribute a workout to a routine they don't own. Tightened both policies
-- to require routine_id to be null or owned by auth.uid(), mirroring the check
-- routine_exercises already does for its own routine_id.

begin;

drop policy if exists "Users can create own workout logs" on public.workout_logs;
create policy "Users can create own workout logs"
on public.workout_logs for insert
to authenticated
with check (
  auth.uid() = user_id
  and (
    routine_id is null
    or exists (
      select 1 from public.routines
      where routines.id = workout_logs.routine_id
        and routines.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can update own workout logs" on public.workout_logs;
create policy "Users can update own workout logs"
on public.workout_logs for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (
    routine_id is null
    or exists (
      select 1 from public.routines
      where routines.id = workout_logs.routine_id
        and routines.user_id = auth.uid()
    )
  )
);

commit;
