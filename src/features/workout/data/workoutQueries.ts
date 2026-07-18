import { supabase } from "@/lib/supabase";
import type { ExercisePreference, ExerciseRow, HistorySetRow, RoutineRow } from "../types";

// Columnas opcionales que añade la migración 20260723_add_supersets_and_set_details.
// Se aíslan para poder reintentar sin ellas si el proyecto Supabase aún no la aplicó
// (PostgREST devuelve 42703 "column ... does not exist" y tumbaría toda la rutina).
const OPTIONAL_ROUTINE_EXERCISE_COLUMNS = ["superset_group", "set_style"] as const;

const buildRoutineSelect = (includeOptional: boolean) => `
  id,
  title,
  description,
  is_deload_week,
  routine_exercises (
    id,
    order_index,
    target_sets,
    target_reps,
    notes,
    rest_seconds,
    target_rpe,
    target_rir,
    tempo,
    priority,
    progression_rule,
    substitution_criteria,${includeOptional ? "\n    " + OPTIONAL_ROUTINE_EXERCISE_COLUMNS.join(",\n    ") + "," : ""}
    exercises (
      id,
      name,
      target_muscle,
      equipment
    )
  )
`;

// Un fallo por columna inexistente (42703) sobre las columnas opcionales significa
// que la migración de supersets/estilos de serie no está aplicada en este proyecto.
function isMissingOptionalColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42703") return true;
  const message = error.message ?? "";
  return OPTIONAL_ROUTINE_EXERCISE_COLUMNS.some(
    (column) => message.includes(column) && message.includes("does not exist")
  );
}

export async function fetchRoutine(routineId: string) {
  const { data, error } = await supabase
    .from("routines")
    .select(buildRoutineSelect(true))
    .eq("id", routineId)
    .single();

  // Degradación elegante: si faltan las columnas opcionales (migración pendiente),
  // recargamos sin ellas y las rellenamos a null para no romper la vista de rutina.
  if (error && isMissingOptionalColumnError(error)) {
    const fallback = await supabase
      .from("routines")
      .select(buildRoutineSelect(false))
      .eq("id", routineId)
      .single();

    const routine = fallback.data as unknown as RoutineRow | null;
    if (routine?.routine_exercises) {
      routine.routine_exercises = routine.routine_exercises.map((item) => ({
        ...item,
        superset_group: null,
        set_style: null,
      }));
    }

    return { data: routine, error: fallback.error };
  }

  return { data: data as unknown as RoutineRow | null, error };
}

export async function fetchExerciseHistory(userId: string, exerciseIds: string[]) {
  const { data, error } = await supabase
    .from("set_logs")
    .select("exercise_id, workout_log_id, weight, reps, rpe, is_warmup, created_at, workout_logs!inner(user_id)")
    .in("exercise_id", exerciseIds)
    .eq("workout_logs.user_id", userId)
    .order("created_at", { ascending: false });

  return { data: data as unknown as HistorySetRow[] | null, error };
}

export async function fetchSubstituteOptions(targetMuscle: string, excludeExerciseId: string) {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, name, target_muscle, equipment")
    .eq("target_muscle", targetMuscle)
    .is("owner_id", null)
    .neq("id", excludeExerciseId)
    .order("name")
    .limit(20);

  return { data: (data || []) as ExerciseRow[], error };
}

export async function fetchExercisePreferences(userId: string) {
  const { data, error } = await supabase
    .from("user_exercise_preferences")
    .select("id, exercise_id, is_favorite, is_avoided")
    .eq("user_id", userId);

  return { data: (data || []) as ExercisePreference[], error };
}
