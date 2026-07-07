import { supabase } from "@/lib/supabase";
import type { ExercisePreference, ExerciseRow, HistorySetRow, RoutineRow } from "../types";

export async function fetchRoutine(routineId: string) {
  const { data, error } = await supabase
    .from("routines")
    .select(`
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
        substitution_criteria,
        exercises (
          id,
          name,
          target_muscle,
          equipment
        )
      )
    `)
    .eq("id", routineId)
    .single();

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
