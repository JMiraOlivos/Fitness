import type { ExercisePriority } from "@/lib/training/progression";

export type ExerciseRow = {
  id: string;
  name: string;
  target_muscle: string;
  equipment: string;
};

export type RoutineExerciseRow = {
  id: string;
  order_index: number;
  target_sets: number | null;
  target_reps: string | null;
  notes: string | null;
  rest_seconds: number | null;
  target_rpe: number | null;
  target_rir: number | null;
  tempo: string | null;
  priority: ExercisePriority | null;
  progression_rule: string | null;
  substitution_criteria: string | null;
  exercises?: ExerciseRow | ExerciseRow[] | null;
};

export type RoutineRow = {
  id: string;
  title: string;
  description: string | null;
  is_deload_week: boolean | null;
  routine_exercises?: RoutineExerciseRow[];
};

export type SetInput = {
  weight: string;
  reps: string;
  rpe: string;
  isWarmup: boolean;
};

export type LocalSetLog = {
  id: string;
  set_number: number;
  weight: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  pending?: boolean;
};

export type WorkoutInsightResponse = {
  insight?: string;
  focoProximoEntrenamiento?: string;
  alerta?: string;
  score?: number;
  error?: string;
};

export type HistorySetRow = {
  exercise_id: string;
  workout_log_id: string;
  weight: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  created_at: string;
};

export type ExerciseSuggestion = {
  lastWeight: number;
  lastReps: number;
  lastRpe: number | null;
  lastDate: string;
  suggestedWeight: number;
  suggestionLabel: string;
};

export type ReadinessForm = {
  energy: number;
  sleepQuality: number;
  soreness: number;
  jointPain: boolean;
  availableMinutes: number | null;
  notes: string;
};

export type { ExercisePriority };
