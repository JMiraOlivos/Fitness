-- Minimal stand-in for Supabase Auth, used only to run this repo's SQL
-- migrations against a plain Postgres instance in tests. Provides just enough
-- of `auth.users` and `auth.uid()` for the RLS policies and `security definer`
-- RPCs in supabase/migrations/ to behave the same way they do against a real
-- Supabase project. Not part of the real schema — never apply this to a
-- Supabase-managed database.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end
$$;

grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;

-- Table-level grants are intentionally omitted: every write path under test goes
-- through `security definer` RPCs (executed as this script's connecting role, not
-- as `authenticated`), so the `authenticated` role only ever needs EXECUTE on those
-- functions — already granted by the migrations themselves.
