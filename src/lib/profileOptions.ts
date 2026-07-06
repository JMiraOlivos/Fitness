// Canonical option lists for the persistent user profile. Mirrors the CHECK
// constraints added in supabase/migrations/20260707_add_persistent_profile_fields.sql —
// keep both in sync.
export const TRAINING_GOALS = [
  "Hipertrofia",
  "Fuerza",
  "Resistencia",
  "Pérdida de grasa",
  "Recomposición corporal",
] as const;

export const EXPERIENCE_LEVELS = ["Principiante", "Intermedio", "Avanzado"] as const;

export const EQUIPMENT_AVAILABILITY = [
  "Gimnasio completo",
  "Mancuernas y banca en casa",
  "Solo peso corporal",
  "Bandas de resistencia",
] as const;
