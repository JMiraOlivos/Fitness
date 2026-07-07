import { getAllPendingOps, deletePendingOp, updatePendingOpRetry, countPendingOps } from "./db";
import { startWorkout, logSet, finishWorkout } from "@/features/workout/data/workoutMutations";
import { supabase } from "@/lib/supabase";

type SyncCallback = () => void;
type SyncPhase = "idle" | "syncing" | "done";

let callbacks: SyncCallback[] = [];
let phase: SyncPhase = "idle";
let pendingCount = 0;

export function getPendingCount() {
  return pendingCount;
}

export function isSyncing() {
  return phase === "syncing";
}

export function onSyncChange(cb: SyncCallback) {
  callbacks.push(cb);
  return () => {
    callbacks = callbacks.filter((c) => c !== cb);
  };
}

function notify() {
  for (const cb of callbacks) {
    cb();
  }
}

async function refreshCount() {
  pendingCount = await countPendingOps();
  notify();
}

export async function processQueue(): Promise<void> {
  if (phase === "syncing") return;

  phase = "syncing";
  notify();

  const tempToReal: Record<string, string> = {};

  try {
    const ops = await getAllPendingOps();
    if (ops.length === 0) {
      phase = "done";
      notify();
      return;
    }

    // Sort by createdAt so start_workout processes before log_set before finish
    ops.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    for (const op of ops) {
      try {
        if (op.id === undefined) continue;

        switch (op.type) {
          case "start_workout": {
            const p = op.payload as { routineId: string; tempWorkoutLogId: string };
            const result = await startWorkout(p.routineId, op.clientOperationId);
            // Map temp ID to real server ID
            tempToReal[p.tempWorkoutLogId] = result.id;
            await deletePendingOp(op.id);
            break;
          }
          case "log_set": {
            const p = op.payload as {
              workoutLogId: string;
              exerciseId: string;
              setNumber: number;
              weight: number;
              reps: number;
              rpe: number | null;
              isWarmup: boolean;
            };
            const realWorkoutLogId = tempToReal[p.workoutLogId] || p.workoutLogId;
            await logSet({
              workoutLogId: realWorkoutLogId,
              exerciseId: p.exerciseId,
              setNumber: p.setNumber,
              weight: p.weight,
              reps: p.reps,
              rpe: p.rpe,
              isWarmup: p.isWarmup,
              clientOperationId: op.clientOperationId,
            });
            await deletePendingOp(op.id);
            break;
          }
          case "finish_workout": {
            const p = op.payload as { workoutLogId: string; aiInsight: string | null };
            const realWorkoutLogId = tempToReal[p.workoutLogId] || p.workoutLogId;
            await finishWorkout(realWorkoutLogId, p.aiInsight || "");
            await deletePendingOp(op.id);
            break;
          }
          case "substitute_exercise": {
            const p = op.payload as { routineExerciseId: string; newExerciseId: string };
            const { error } = await supabase
              .from("routine_exercises")
              .update({ exercise_id: p.newExerciseId })
              .eq("id", p.routineExerciseId);
            if (error) throw new Error(error.message);
            await deletePendingOp(op.id);
            break;
          }
          case "readiness_log": {
            const p = op.payload as {
              userId: string;
              workoutLogId: string;
              form: Record<string, unknown>;
            };
            const realWorkoutLogId = tempToReal[p.workoutLogId] || p.workoutLogId;
            const { error } = await supabase.from("readiness_logs").insert({
              user_id: p.userId,
              workout_log_id: realWorkoutLogId || null,
              energy: (p.form as any).energy,
              sleep_quality: (p.form as any).sleepQuality,
              soreness: (p.form as any).soreness,
              joint_pain: (p.form as any).jointPain,
              available_minutes: (p.form as any).availableMinutes,
              notes: (p.form as any).notes || null,
              client_operation_id: op.clientOperationId,
            });
            if (error) throw new Error(error.message);
            await deletePendingOp(op.id);
            break;
          }
        }

        notify();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Error de sincronización";
        if (op.id !== undefined) {
          await updatePendingOpRetry(op.id, errorMessage);
          if (op.retryCount >= 5) {
            await deletePendingOp(op.id);
          }
        }
      }
    }
  } finally {
    phase = "done";
    await refreshCount();
    notify();
  }
}

export function initSyncManager() {
  if (typeof window === "undefined") return;

  const handleOnline = () => {
    processQueue().catch(console.error);
  };

  window.addEventListener("online", handleOnline);

  // Initial sync if there are pending ops and we're online
  void processQueue();

  return () => {
    window.removeEventListener("online", handleOnline);
  };
}
