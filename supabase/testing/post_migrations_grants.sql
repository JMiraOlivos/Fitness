-- On a real Supabase project, the platform grants baseline table/sequence
-- privileges to `authenticated`/`anon` automatically (outside of this repo's
-- migrations) — RLS policies are what actually restrict access on top of that.
-- This test harness has to replicate that platform-level grant explicitly,
-- applied last (after all migrations) so it covers every table that exists by
-- then, including ones with no RPC in front of them (e.g. `programs`, which is
-- written to directly from the client per the mesociclos design).

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
