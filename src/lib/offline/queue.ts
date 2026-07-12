import { addPendingOp } from "./db";

function generateUUID() {
  return crypto.randomUUID();
}

export function enqueueStartWorkout(routineId: string): { clientOperationId: string; tempWorkoutLogId: string } {
  const clientOperationId = generateUUID();
  const tempWorkoutLogId = `local-${generateUUID()}`;

  void addPendingOp({
    type: "start_workout",
    clientOperationId,
    payload: { routineId, tempWorkoutLogId },
  });

  return { clientOperationId, tempWorkoutLogId };
}

export function enqueueLogSet(params: {
  workoutLogId: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  rpe: number | null;
  rir?: number | null;
  side?: string | null;
  tempoSeconds?: number | null;
  isWarmup: boolean;
}): { clientOperationId: string; tempSetId: string } {
  const clientOperationId = generateUUID();
  const tempSetId = `local-${generateUUID()}`;

  void addPendingOp({
    type: "log_set",
    clientOperationId,
    payload: { ...params, tempSetId },
  });

  return { clientOperationId, tempSetId };
}

export function enqueueFinishWorkout(workoutLogId: string, aiInsight: string | null): string {
  const clientOperationId = generateUUID();

  void addPendingOp({
    type: "finish_workout",
    clientOperationId,
    payload: { workoutLogId, aiInsight },
  });

  return clientOperationId;
}

export function enqueueSubstituteExercise(routineExerciseId: string, newExerciseId: string): string {
  const clientOperationId = generateUUID();

  void addPendingOp({
    type: "substitute_exercise",
    clientOperationId,
    payload: { routineExerciseId, newExerciseId },
  });

  return clientOperationId;
}

export function enqueueReadinessLog(params: {
  userId: string;
  workoutLogId: string;
  form: Record<string, unknown>;
}): string {
  const clientOperationId = generateUUID();

  void addPendingOp({
    type: "readiness_log",
    clientOperationId,
    payload: params,
  });

  return clientOperationId;
}
