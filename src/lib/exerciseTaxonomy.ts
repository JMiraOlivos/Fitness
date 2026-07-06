// Canonical taxonomy for exercises.target_muscle / exercises.equipment. Mirrors the
// CHECK constraints added in supabase/migrations/20260707_standardize_exercise_taxonomy.sql —
// keep both in sync. FALLBACK_* are DB-only safety nets for legacy/unrecognized values,
// not valid choices for newly AI-generated exercises.
export const MUSCLE_GROUPS = [
  "Pecho",
  "Espalda",
  "Hombro",
  "Bíceps",
  "Tríceps",
  "Antebrazo",
  "Cuádriceps",
  "Isquiotibiales",
  "Glúteo",
  "Pantorrilla",
  "Core",
  "Trapecio",
] as const;

export const FALLBACK_MUSCLE_GROUP = "General";

export const EQUIPMENT_TYPES = ["Polea", "Barra", "Máquina", "Mancuerna", "Corporal"] as const;

export const FALLBACK_EQUIPMENT = "Otro";
