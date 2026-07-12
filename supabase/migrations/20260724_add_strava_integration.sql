-- Integración de Strava (Fase 1: conexión OAuth + resumen cardiaco).
--
-- Estrategia (ver docs/propuesta_integracion_strava_ajustada.md):
--   * strava_connections: credenciales OAuth cifradas. RLS habilitado SIN policies:
--     solo el service role (rutas server-side) puede leer/escribir tokens. El
--     navegador nunca ve access/refresh tokens.
--   * strava_activities: staging de cada actividad importada. Se asocia por tipo:
--     fuerza -> workout_logs.id ; cardio -> cardio_logs.id. Ambas FKs nullable.
--   * strava_hr_streams: curva time/heartrate como arrays (una fila por actividad).
--
-- No se crea tabla de OAuth state: el state es un token HMAC firmado y sin estado
-- (STRAVA_STATE_SECRET), validado en el callback sin tocar la base.
--
-- No se añaden columnas de FC al perfil: profiles.max_heart_rate y profiles.birth_year
-- ya existen (20260723_add_cardio_planning_and_hr.sql) y las zonas se derivan con
-- src/lib/training/hrZones.ts. Esta migración no las duplica.

begin;

-- 1) Conexión y tokens -------------------------------------------------------
create table public.strava_connections (
  user_id uuid primary key references public.profiles(id) on delete cascade,

  athlete_id bigint not null,
  athlete_name text,

  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  token_expires_at timestamptz not null,

  scopes text[] not null default '{}',
  status text not null default 'connected'
    check (status in ('connected', 'revoked', 'error')),

  last_sync_at timestamptz,
  last_sync_status text,
  last_sync_error text,

  connected_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.strava_connections enable row level security;
-- Intencionalmente SIN policies: contiene credenciales externas y solo debe
-- accederse desde el servidor con el service role. Ninguna consulta de cliente
-- (anon/authenticated) debe poder leer esta tabla.

-- 2) Actividades importadas --------------------------------------------------
create table public.strava_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  strava_activity_id bigint not null,

  -- Asociación ramificada por tipo de actividad. Como máximo una de las dos.
  workout_log_id uuid references public.workout_logs(id) on delete set null,
  cardio_log_id uuid references public.cardio_logs(id) on delete set null,

  name text,
  sport_type text,
  start_date timestamptz not null,
  start_date_local timestamp,
  timezone text,
  elapsed_time_seconds integer,
  moving_time_seconds integer,

  has_heartrate boolean not null default false,
  average_heartrate numeric(5,1),
  max_heartrate smallint,
  min_heartrate smallint,
  calories numeric(10,2),
  distance_meters numeric(10,1),
  device_name text,

  match_status text not null default 'unmatched'
    check (match_status in ('matched_auto', 'matched_manual', 'unmatched', 'ignored')),
  match_score numeric(5,2),

  imported_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),

  unique (user_id, strava_activity_id)
);

-- Una actividad de Strava como mucho ocupa un workout_log y/o un cardio_log, y ese
-- destino no puede estar ocupado por dos actividades distintas. Índices únicos
-- parciales (en vez de UNIQUE de columna) para no bloquear las filas del otro tipo,
-- que tienen la columna a NULL.
create unique index strava_activities_workout_log_unique
  on public.strava_activities(workout_log_id)
  where workout_log_id is not null;

create unique index strava_activities_cardio_log_unique
  on public.strava_activities(cardio_log_id)
  where cardio_log_id is not null;

create index strava_activities_user_start_idx
  on public.strava_activities(user_id, start_date desc);

alter table public.strava_activities enable row level security;

-- Lectura para el dueño (simplifica UI y joins). Las escrituras van por el servidor.
create policy "Users can read own Strava activities"
on public.strava_activities for select
to authenticated
using (auth.uid() = user_id);

-- 3) Stream cardiaco ---------------------------------------------------------
create table public.strava_hr_streams (
  strava_activity_id uuid primary key
    references public.strava_activities(id) on delete cascade,

  user_id uuid not null references public.profiles(id) on delete cascade,

  time_seconds integer[] not null,
  heartrate_bpm smallint[] not null,

  original_size integer,
  resolution text,
  sample_count integer not null,

  created_at timestamptz not null default timezone('utc'::text, now()),

  check (cardinality(time_seconds) = cardinality(heartrate_bpm))
);

alter table public.strava_hr_streams enable row level security;

create policy "Users can read own Strava heart rate streams"
on public.strava_hr_streams for select
to authenticated
using (auth.uid() = user_id);

commit;
