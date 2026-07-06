-- Follow-up to the RLS review (20260706_harden_workout_logs_routine_ownership.sql),
-- which flagged that `exercises` allowed any authenticated user to insert directly
-- (`with check (true)`), bypassing the RPC's name/muscle/equipment normalization and
-- dedup. That was load-bearing for the client-side legacy fallback in
-- guardarRutinaLegacy() (src/app/page.tsx). That fallback is gone now that routine
-- saving goes through POST /api/routines/save, which always calls the
-- security-definer save_ai_routine RPC (bypassing RLS on its own, by design) — no
-- client code inserts into `exercises` directly anymore. Deny direct inserts.

begin;

drop policy if exists "Authenticated users can create exercises" on public.exercises;

commit;
