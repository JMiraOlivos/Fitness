-- vNext++ U9 + U10 (ROADMAP.md): integrar el cardio al plan y habilitar zonas de
-- frecuencia cardíaca.
--   U9: el cardio deja de ser un cuaderno aislado — se puede asociar a un programa
--       (para que cuente en adherencia) y a la sesión de fuerza del mismo día.
--   U10: FC máxima por sesión + esfuerzo percibido; la FC máx del usuario (medida o
--       estimada por edad con birth_year) permite derivar zonas Z1-Z5 en el cliente.
-- Todas las columnas son nullable: los registros de cardio existentes siguen válidos.

begin;

alter table public.cardio_logs
  add column if not exists program_id uuid references public.programs(id) on delete set null,
  add column if not exists workout_log_id uuid references public.workout_logs(id) on delete set null,
  add column if not exists heart_rate_max integer,
  add column if not exists perceived_effort integer;

alter table public.cardio_logs
  drop constraint if exists cardio_logs_perceived_effort_check,
  add constraint cardio_logs_perceived_effort_check
    check (perceived_effort is null or perceived_effort between 1 and 10),
  drop constraint if exists cardio_logs_heart_rate_max_check,
  add constraint cardio_logs_heart_rate_max_check
    check (heart_rate_max is null or heart_rate_max between 60 and 240);

-- Para estimar FC máxima por edad (fórmula Tanaka: 208 - 0.7*edad) cuando el usuario
-- no mide su FC máx real. max_heart_rate permite un override manual medido en test.
alter table public.profiles
  add column if not exists birth_year integer,
  add column if not exists max_heart_rate integer;

alter table public.profiles
  drop constraint if exists profiles_birth_year_check,
  add constraint profiles_birth_year_check
    check (birth_year is null or birth_year between 1900 and 2025),
  drop constraint if exists profiles_max_heart_rate_check,
  add constraint profiles_max_heart_rate_check
    check (max_heart_rate is null or max_heart_rate between 120 and 240);

commit;
