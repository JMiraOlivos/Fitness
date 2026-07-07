import { authFetch } from "@/lib/authFetch";
import { supabase } from "@/lib/supabase";
import type { ReadinessForm, WorkoutInsightResponse } from "../types";

export async function substituteExercise(routineExerciseId: string, newExerciseId: string) {
  return supabase.from("routine_exercises").update({ exercise_id: newExerciseId }).eq("id", routineExerciseId);
}

export async function saveReadinessLog(params: {
  userId: string;
  workoutLogId: string;
  form: ReadinessForm;
  clientOperationId?: string;
}) {
  const { userId, workoutLogId, form, clientOperationId } = params;

  return supabase.from("readiness_logs").insert({
    user_id: userId,
    workout_log_id: workoutLogId,
    energy: form.energy,
    sleep_quality: form.sleepQuality,
    soreness: form.soreness,
    joint_pain: form.jointPain,
    available_minutes: form.availableMinutes,
    notes: form.notes || null,
    client_operation_id: clientOperationId ?? null,
  });
}

export async function startWorkout(routineId: string, clientOperationId?: string) {
  return authFetch<{ id: string; startTime: string | null }>("/api/workouts/start", { routineId, clientOperationId });
}

export async function logSet(params: {
  workoutLogId: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  rpe: number | null;
  isWarmup: boolean;
  clientOperationId?: string;
}) {
  return authFetch<{ id: string; set_number: number; weight: number; reps: number; rpe: number | null; is_warmup: boolean }>(
    "/api/workouts/log-set",
    params
  );
}

export async function finishWorkout(workoutLogId: string, aiInsight: string) {
  return authFetch("/api/workouts/finish", { workoutLogId, aiInsight });
}

export async function regenerateDay(routineId: string, instrucciones: string) {
  return authFetch("/api/ai/regenerar-dia", { routineId, instrucciones });
}

export async function analyzeWorkout(payload: Record<string, unknown>): Promise<WorkoutInsightResponse | null> {
  // Best-effort: attach the access token so the route can pull each exercise's
  // trend across prior sessions; still works without one (anonymous callers).
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const response = await fetch("/api/ai/analizar-entrenamiento", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as WorkoutInsightResponse;
}
