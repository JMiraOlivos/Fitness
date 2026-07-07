import { recommendNextSet } from "@/lib/training/progression";
import type { ExercisePriority, ExerciseSuggestion, HistorySetRow, LocalSetLog, ReadinessForm, SetInput } from "../types";

export const REST_DURATION_SECONDS = 90;

export const AVAILABLE_MINUTES_OPTIONS = [30, 45, 60, 75];

export const PRIORITY_LABELS: Record<ExercisePriority, string> = {
  principal: "principal",
  accesorio: "accesorio",
  aislamiento: "aislamiento",
  correctivo: "correctivo",
};

export function defaultReadinessForm(): ReadinessForm {
  return { energy: 3, sleepQuality: 3, soreness: 3, jointPain: false, availableMinutes: null, notes: "" };
}

export function defaultInput(): SetInput {
  return {
    weight: "",
    reps: "",
    rpe: "8",
    isWarmup: false,
  };
}

export function formatRestTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function formatRelativeDate(value: string) {
  return new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

// Warmup sets are logged but excluded from volume/1RM/RPE-average so they don't
// understate how hard the working sets actually were.
export function getVolume(logs: LocalSetLog[]) {
  return logs
    .filter((log) => !log.is_warmup)
    .reduce((sum, log) => sum + log.weight * log.reps, 0);
}

export function getAverageRpe(logs: LocalSetLog[]) {
  const rpeLogs = logs.filter((log) => !log.is_warmup && log.rpe !== null);
  if (rpeLogs.length === 0) return null;
  return rpeLogs.reduce((sum, log) => sum + Number(log.rpe || 0), 0) / rpeLogs.length;
}

export function buildSuggestion(
  sessionRows: HistorySetRow[],
  isDeloadWeek: boolean,
  priority: ExercisePriority | null
): ExerciseSuggestion | null {
  const workingRows = sessionRows.filter((row) => !row.is_warmup);
  if (workingRows.length === 0) return null;

  const lastSet = workingRows[0];
  const maxWeight = workingRows.reduce((max, row) => Math.max(max, row.weight), 0);
  const rpeValues = workingRows.filter((row) => row.rpe !== null).map((row) => row.rpe as number);
  const averageRpe = rpeValues.length > 0 ? rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length : null;

  const recommendation = recommendNextSet({
    lastSession: { maxWeight, lastReps: lastSet.reps, averageRpe },
    isDeloadWeek,
    priority: priority ?? undefined,
  });

  return {
    lastWeight: lastSet.weight,
    lastReps: lastSet.reps,
    lastRpe: lastSet.rpe,
    lastDate: lastSet.created_at,
    suggestedWeight: recommendation?.suggestedWeight ?? maxWeight,
    suggestionLabel: recommendation?.reason ?? "Repite el peso, ajusta reps si puedes.",
  };
}
