// Canonical taxonomy for routine_exercises prescription fields (ROADMAP.md, Fase vNext 1).
// Mirrors the CHECK constraints in supabase/migrations/20260711_add_routine_exercise_prescription.sql
// and the Zod enums in the routine-generation prompts — keep all three in sync.
export const EXERCISE_PRIORITIES = ["principal", "accesorio", "aislamiento", "correctivo"] as const;

export type ExercisePriority = (typeof EXERCISE_PRIORITIES)[number];

export const MOVEMENT_PATTERNS = [
  "squat",
  "hinge",
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "lunge",
  "carry",
  "core",
  "isolation",
  "conditioning",
  "mobility",
] as const;

export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export const MIN_TARGET_RPE = 1;
export const MAX_TARGET_RPE = 10;
export const MIN_TARGET_RIR = 0;
export const MAX_TARGET_RIR = 5;
export const MIN_REST_SECONDS = 30;
export const MAX_REST_SECONDS = 600;
