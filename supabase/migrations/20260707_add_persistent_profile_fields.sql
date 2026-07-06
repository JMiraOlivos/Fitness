-- Persistent user profile fields (Fase 8): objetivo, lesiones/restricciones,
-- equipo disponible y nivel de experiencia, so generar-rutina can read the user's
-- real, persistent preferences instead of relying only on whatever they retype into
-- the per-generation form. This is where the actual fix for the Fase 0 bug lives —
-- Fase 0 only stopped the system prompt from injecting someone else's hardcoded
-- preferences; this is what lets a user's own preferences persist across sessions.
--
-- All nullable: an unfilled profile changes nothing about today's behavior.
-- training_goal/experience_level/equipment_available are constrained to a fixed list
-- (mirrored in src/lib/profileOptions.ts) since they're picked from a dropdown, not
-- freely typed. injury_notes stays free text — restrictions can't be enumerated.

alter table public.profiles
  add column if not exists training_goal text,
  add column if not exists injury_notes text,
  add column if not exists equipment_available text,
  add column if not exists experience_level text;

alter table public.profiles
  drop constraint if exists profiles_training_goal_check,
  add constraint profiles_training_goal_check check (
    training_goal is null or training_goal in (
      'Hipertrofia', 'Fuerza', 'Resistencia', 'Pérdida de grasa', 'Recomposición corporal'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_experience_level_check,
  add constraint profiles_experience_level_check check (
    experience_level is null or experience_level in ('Principiante', 'Intermedio', 'Avanzado')
  );

alter table public.profiles
  drop constraint if exists profiles_equipment_available_check,
  add constraint profiles_equipment_available_check check (
    equipment_available is null or equipment_available in (
      'Gimnasio completo', 'Mancuernas y banca en casa', 'Solo peso corporal', 'Bandas de resistencia'
    )
  );
