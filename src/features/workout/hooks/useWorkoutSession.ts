import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { one } from "@/lib/supabaseJoins";
import { useSession } from "@/components/SessionProvider";
import { getReadinessGuidance, type ReadinessGuidance } from "@/lib/training/readiness";
import {
  AVAILABLE_MINUTES_OPTIONS,
  REST_DURATION_SECONDS,
  buildSuggestion,
  defaultInput,
  defaultReadinessForm,
  getAverageRpe,
  getVolume,
} from "../domain/workoutMetrics";
import { fetchExerciseHistory, fetchRoutine, fetchSubstituteOptions } from "../data/workoutQueries";
import {
  analyzeWorkout,
  finishWorkout,
  logSet,
  regenerateDay,
  saveReadinessLog,
  startWorkout,
  substituteExercise,
} from "../data/workoutMutations";
import {
  enqueueStartWorkout,
  enqueueLogSet,
  enqueueFinishWorkout,
  enqueueSubstituteExercise,
  enqueueReadinessLog,
} from "@/lib/offline/queue";
import { useConnectivity } from "@/lib/offline/useConnectivity";
import type {
  ExercisePriority,
  ExerciseRow,
  ExerciseSuggestion,
  LocalSetLog,
  ReadinessForm,
  RoutineExerciseRow,
  RoutineRow,
  SetInput,
} from "../types";

export { AVAILABLE_MINUTES_OPTIONS };

export function useWorkoutSession(routineId: string) {
  const router = useRouter();

  const { user, isLoading: isSessionLoading } = useSession();
  const [routine, setRoutine] = useState<RoutineRow | null>(null);
  const [workoutLogId, setWorkoutLogId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [inputs, setInputs] = useState<Record<string, SetInput>>({});
  const [setLogs, setSetLogs] = useState<Record<string, LocalSetLog[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isSavingSet, setIsSavingSet] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, ExerciseSuggestion>>({});
  const [substitutingItemId, setSubstitutingItemId] = useState<string | null>(null);
  const [substituteOptions, setSubstituteOptions] = useState<ExerciseRow[]>([]);
  const [isLoadingSubstitutes, setIsLoadingSubstitutes] = useState(false);
  const [isSubstituting, setIsSubstituting] = useState(false);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [completedExerciseIds, setCompletedExerciseIds] = useState<Set<string>>(new Set());
  const [showRegeneratePanel, setShowRegeneratePanel] = useState(false);
  const [regenerateInstructions, setRegenerateInstructions] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showReadinessModal, setShowReadinessModal] = useState(false);
  const [readinessForm, setReadinessForm] = useState<ReadinessForm>(defaultReadinessForm());
  const [readinessGuidance, setReadinessGuidance] = useState<ReadinessGuidance | null>(null);
  const exerciseRefs = useRef<Record<string, HTMLElement | null>>({});
  const { isOnline } = useConnectivity();
  const [pendingSetIds, setPendingSetIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (restSecondsLeft === null || restSecondsLeft <= 0) return;

    const timeout = setTimeout(() => {
      setRestSecondsLeft((current) => (current !== null ? current - 1 : null));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [restSecondsLeft]);

  // Best-effort: navigator.vibrate is Android-only (no-op on iOS Safari/desktop),
  // so this degrades silently where unsupported instead of needing a toggle.
  useEffect(() => {
    if (restSecondsLeft !== 0) return;
    try {
      navigator.vibrate?.(200);
    } catch {
      // ignore — vibration is a nice-to-have, never worth failing the rest timer over
    }
  }, [restSecondsLeft]);

  const routineExercises = useMemo(() => {
    return [...(routine?.routine_exercises || [])].sort((a, b) => a.order_index - b.order_index);
  }, [routine]);

  const cargarSugerencias = useCallback(
    async (
      userId: string,
      exerciseIds: string[],
      isDeloadWeek: boolean,
      priorityByExercise: Record<string, ExercisePriority | null>
    ) => {
      const { data: historyRows, error: historyError } = await fetchExerciseHistory(userId, exerciseIds);

      if (historyError || !historyRows) {
        return;
      }

      const lastWorkoutByExercise: Record<string, string> = {};
      const sessionsByExercise: Record<string, typeof historyRows> = {};

      for (const row of historyRows) {
        const currentWorkoutLogId = lastWorkoutByExercise[row.exercise_id];

        if (!currentWorkoutLogId) {
          lastWorkoutByExercise[row.exercise_id] = row.workout_log_id;
          sessionsByExercise[row.exercise_id] = [row];
        } else if (currentWorkoutLogId === row.workout_log_id) {
          sessionsByExercise[row.exercise_id].push(row);
        }
      }

      const nextSuggestions: Record<string, ExerciseSuggestion> = {};

      for (const exerciseId of Object.keys(sessionsByExercise)) {
        const suggestion = buildSuggestion(sessionsByExercise[exerciseId], isDeloadWeek, priorityByExercise[exerciseId] ?? null);
        if (suggestion) {
          nextSuggestions[exerciseId] = suggestion;
        }
      }

      setSuggestions(nextSuggestions);
    },
    []
  );

  const cargarRutina = useCallback(
    async (userId: string) => {
      setIsLoading(true);
      setError(null);

      const { data: loadedRoutine, error: routineError } = await fetchRoutine(routineId);

      if (routineError || !loadedRoutine) {
        setError(routineError?.message || "No pudimos cargar esta rutina.");
        setIsLoading(false);
        return;
      }

      setRoutine(loadedRoutine);

      const exerciseIds = (loadedRoutine.routine_exercises || [])
        .map((item) => one(item.exercises)?.id)
        .filter((id): id is string => Boolean(id));

      const priorityByExercise: Record<string, ExercisePriority | null> = {};
      for (const item of loadedRoutine.routine_exercises || []) {
        const exerciseId = one(item.exercises)?.id;
        if (exerciseId) {
          priorityByExercise[exerciseId] = item.priority;
        }
      }

      if (exerciseIds.length > 0) {
        await cargarSugerencias(userId, exerciseIds, Boolean(loadedRoutine.is_deload_week), priorityByExercise);
      }

      setIsLoading(false);
    },
    [routineId, cargarSugerencias]
  );

  useEffect(() => {
    if (isSessionLoading) return;

    if (!user) {
      setIsLoading(false);
      return;
    }

    void cargarRutina(user.id);
  }, [user, isSessionLoading, cargarRutina]);

  function updateInput(routineExerciseId: string, patch: Partial<SetInput>) {
    setInputs((current) => ({
      ...current,
      [routineExerciseId]: {
        ...defaultInput(),
        ...(current[routineExerciseId] || {}),
        ...patch,
      },
    }));
  }

  function aplicarSugerencia(routineExerciseId: string, suggestion: ExerciseSuggestion) {
    updateInput(routineExerciseId, {
      weight: String(suggestion.suggestedWeight),
      reps: String(suggestion.lastReps),
    });
  }

  // "Copiar sesión anterior completa" (Fase vNext 6, resto): applies every
  // exercise's suggestion at once instead of one at a time.
  function aplicarTodasLasSugerencias() {
    for (const item of routineExercises) {
      const exerciseId = one(item.exercises)?.id;
      const suggestion = exerciseId ? suggestions[exerciseId] : undefined;
      if (suggestion) {
        aplicarSugerencia(item.id, suggestion);
      }
    }
  }

  function copiarSerieAnterior(routineExerciseId: string, ultimaSerie: LocalSetLog) {
    updateInput(routineExerciseId, {
      weight: String(ultimaSerie.weight),
      reps: String(ultimaSerie.reps),
      rpe: ultimaSerie.rpe !== null ? String(ultimaSerie.rpe) : "",
    });
  }

  function ajustarPeso(routineExerciseId: string, delta: number) {
    setInputs((current) => {
      const existing = current[routineExerciseId] || defaultInput();
      const nextWeight = Math.max(0, (Number(existing.weight) || 0) + delta);
      return {
        ...current,
        [routineExerciseId]: { ...existing, weight: String(Math.round(nextWeight * 100) / 100) },
      };
    });
  }

  function ajustarReps(routineExerciseId: string, delta: number) {
    setInputs((current) => {
      const existing = current[routineExerciseId] || defaultInput();
      const nextReps = Math.max(0, (Number.parseInt(existing.reps, 10) || 0) + delta);
      return {
        ...current,
        [routineExerciseId]: { ...existing, reps: String(nextReps) },
      };
    });
  }

  function marcarCompletado(routineExerciseId: string) {
    const wasCompleted = completedExerciseIds.has(routineExerciseId);

    setCompletedExerciseIds((current) => {
      const next = new Set(current);
      if (wasCompleted) {
        next.delete(routineExerciseId);
      } else {
        next.add(routineExerciseId);
      }
      return next;
    });

    if (wasCompleted) return;

    const currentIndex = routineExercises.findIndex((item) => item.id === routineExerciseId);
    const nextItem = routineExercises
      .slice(currentIndex + 1)
      .find((item) => item.id !== routineExerciseId && !completedExerciseIds.has(item.id));

    if (nextItem) {
      requestAnimationFrame(() => {
        exerciseRefs.current[nextItem.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  async function abrirSustitucion(item: RoutineExerciseRow) {
    const exercise = one(item.exercises);
    if (!exercise) return;

    setError(null);
    setSubstitutingItemId(item.id);
    setSubstituteOptions([]);
    setIsLoadingSubstitutes(true);

    const { data, error: loadError } = await fetchSubstituteOptions(exercise.target_muscle, exercise.id);

    setIsLoadingSubstitutes(false);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setSubstituteOptions(data);
  }

  function cerrarSustitucion() {
    setSubstitutingItemId(null);
    setSubstituteOptions([]);
  }

  async function sustituirEjercicio(item: RoutineExerciseRow, nuevoEjercicio: ExerciseRow) {
    setIsSubstituting(true);
    setError(null);

    const { error: updateError } = await substituteExercise(item.id, nuevoEjercicio.id);

    if (updateError) {
      enqueueSubstituteExercise(item.id, nuevoEjercicio.id);
    }

    setRoutine((current) => {
      if (!current) return current;

      return {
        ...current,
        routine_exercises: (current.routine_exercises || []).map((routineExercise) =>
          routineExercise.id === item.id ? { ...routineExercise, exercises: nuevoEjercicio } : routineExercise
        ),
      };
    });

    setSuccessMessage(`${one(item.exercises)?.name || "Ejercicio"} sustituido por ${nuevoEjercicio.name}.`);
    cerrarSustitucion();
    setIsSubstituting(false);
  }

  async function regenerarDia() {
    if (!user) return;

    setError(null);
    setSuccessMessage(null);
    setIsRegenerating(true);

    try {
      await regenerateDay(routineId, regenerateInstructions);

      await cargarRutina(user.id);
      setCompletedExerciseIds(new Set());
      setInputs({});
      setShowRegeneratePanel(false);
      setRegenerateInstructions("");
      setSuccessMessage("Día regenerado con IA.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo regenerar el día.");
    } finally {
      setIsRegenerating(false);
    }
  }

  async function ensureWorkoutLog() {
    if (workoutLogId) {
      return workoutLogId;
    }

    if (!user) {
      throw new Error("Inicia sesión para registrar entrenamientos.");
    }

    if (!routine) {
      throw new Error("No hay una rutina cargada.");
    }

    setIsStarting(true);

    try {
      try {
        const data = await startWorkout(routine.id);
        setWorkoutLogId(data.id);
        setStartTime(data.startTime ? new Date(data.startTime) : new Date());
        setSuccessMessage("Entrenamiento iniciado.");
        return data.id;
      } catch {
        const { tempWorkoutLogId } = enqueueStartWorkout(routine.id);
        setWorkoutLogId(tempWorkoutLogId);
        setStartTime(new Date());
        setSuccessMessage("Entrenamiento iniciado (offline).");
        return tempWorkoutLogId;
      }
    } finally {
      setIsStarting(false);
    }
  }

  async function iniciarConReadiness(shouldAdapt: boolean) {
    setShowReadinessModal(false);
    setError(null);
    setSuccessMessage(null);

    const guidance = shouldAdapt
      ? getReadinessGuidance({
          energy: readinessForm.energy,
          sleepQuality: readinessForm.sleepQuality,
          jointPain: readinessForm.jointPain,
          availableMinutes: readinessForm.availableMinutes,
          notes: readinessForm.notes,
        })
      : null;
    setReadinessGuidance(guidance);

    try {
      const logId = await ensureWorkoutLog();

      if (shouldAdapt && user) {
        const { error: readinessError } = await saveReadinessLog({ userId: user.id, workoutLogId: logId, form: readinessForm });
        if (readinessError) {
          enqueueReadinessLog({ userId: user.id, workoutLogId: logId, form: readinessForm as unknown as Record<string, unknown> });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar el entrenamiento.");
    }
  }

  async function registrarSerie(item: RoutineExerciseRow) {
    setError(null);
    setSuccessMessage(null);
    setIsSavingSet(true);

    try {
      const exercise = one(item.exercises);

      if (!exercise?.id) {
        throw new Error("El ejercicio no tiene ID asociado.");
      }

      const currentInput = inputs[item.id] || defaultInput();
      const weight = Number(currentInput.weight);
      const reps = Number.parseInt(currentInput.reps, 10);
      const rpe = currentInput.rpe ? Number.parseFloat(currentInput.rpe) : null;
      const isWarmup = currentInput.isWarmup;

      if (!Number.isFinite(weight) || weight < 0) {
        throw new Error("Ingresa un peso válido.");
      }

      if (!Number.isFinite(reps) || reps <= 0) {
        throw new Error("Ingresa repeticiones válidas.");
      }

      if (rpe !== null && (!Number.isFinite(rpe) || rpe < 1 || rpe > 10 || Math.round(rpe * 2) !== rpe * 2)) {
        throw new Error("El RPE debe estar entre 1 y 10, en incrementos de 0.5.");
      }

      const logId = await ensureWorkoutLog();
      const setNumber = (setLogs[exercise.id]?.length || 0) + 1;

      let savedSet: LocalSetLog;
      let wasOffline = false;

      try {
        const data = await logSet({
          workoutLogId: logId,
          exerciseId: exercise.id,
          setNumber,
          weight,
          reps,
          rpe,
          isWarmup,
        });

        savedSet = {
          id: data.id,
          set_number: Number(data.set_number),
          weight: Number(data.weight),
          reps: Number(data.reps),
          rpe: data.rpe === null ? null : Number(data.rpe),
          is_warmup: Boolean(data.is_warmup),
        };
      } catch {
        const { tempSetId } = enqueueLogSet({
          workoutLogId: logId,
          exerciseId: exercise.id,
          setNumber,
          weight,
          reps,
          rpe,
          isWarmup,
        });

        savedSet = {
          id: tempSetId,
          set_number: setNumber,
          weight,
          reps,
          rpe,
          is_warmup: isWarmup,
          pending: true,
        };

        setPendingSetIds((current) => new Set(current).add(tempSetId));
        wasOffline = true;
      }

      setSetLogs((current) => ({
        ...current,
        [exercise.id]: [...(current[exercise.id] || []), savedSet],
      }));

      setInputs((current) => ({
        ...current,
        [item.id]: {
          ...defaultInput(),
          weight: currentInput.weight,
          rpe: currentInput.rpe,
        },
      }));

      setSuccessMessage(`Serie ${setNumber} registrada para ${exercise.name}${wasOffline ? " (sin conexión)" : ""}.`);
      setRestSecondsLeft(REST_DURATION_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la serie.");
    } finally {
      setIsSavingSet(false);
    }
  }

  async function generarInsightEntrenamiento(totalSets: number, totalVolume: number) {
    const allLogs = Object.values(setLogs).flat();
    const averageRpe = getAverageRpe(allLogs);
    const fallbackInsight = `Entrenamiento finalizado con ${totalSets} series y ${Math.round(totalVolume)} kg de volumen total.`;

    const exerciseSummaries = routineExercises
      .map((item) => {
        const exercise = one(item.exercises);
        const logs = (exercise?.id ? setLogs[exercise.id] || [] : []).filter((log) => !log.is_warmup);

        return {
          exerciseId: exercise?.id || null,
          exerciseName: exercise?.name || "Ejercicio",
          targetMuscle: exercise?.target_muscle || "",
          sets: logs.length,
          volume: getVolume(logs),
          maxWeight: logs.reduce((max, log) => Math.max(max, log.weight), 0),
          averageRpe: getAverageRpe(logs),
        };
      })
      .filter((summary) => summary.sets > 0);

    const data = await analyzeWorkout({
      routineTitle: routine?.title,
      routineDescription: routine?.description,
      totalSets,
      totalVolume,
      averageRpe,
      startedAt: startTime?.toISOString(),
      finishedAt: new Date().toISOString(),
      workoutLogId,
      exerciseSummaries,
    }).catch(() => null);

    if (!data?.insight) {
      return fallbackInsight;
    }

    return [
      data.insight,
      data.focoProximoEntrenamiento ? `Próximo foco: ${data.focoProximoEntrenamiento}` : null,
      data.alerta && data.alerta !== "Sin alertas relevantes" ? `Alerta: ${data.alerta}` : null,
      data.score ? `Score IA: ${data.score}/10.` : null,
    ]
      .filter(Boolean)
      .join(" ");
  }

  async function finalizarEntrenamiento() {
    setError(null);
    setSuccessMessage(null);

    if (!workoutLogId) {
      setError("Primero inicia y registra al menos una serie.");
      return;
    }

    setIsFinishing(true);

    const allLoggedSets = Object.values(setLogs).flat();
    const totalSets = allLoggedSets.filter((log) => !log.is_warmup).length;

    if (allLoggedSets.length === 0) {
      setIsFinishing(false);
      setError("Registra al menos una serie antes de finalizar.");
      return;
    }

    const isRealWorkoutLog = !workoutLogId.startsWith("local-");
    const totalVolume = Object.values(setLogs).reduce((sum, logs) => sum + getVolume(logs), 0);

    let aiInsight: string;

    if (isRealWorkoutLog && pendingSetIds.size === 0) {
      aiInsight = await generarInsightEntrenamiento(totalSets, totalVolume);
    } else {
      aiInsight = [
        `Entrenamiento finalizado con ${totalSets} series y ${Math.round(totalVolume)} kg de volumen total.`,
        pendingSetIds.size > 0 ? `${pendingSetIds.size} ${pendingSetIds.size === 1 ? "serie pendiente" : "series pendientes"} de sincronizar.` : null,
      ].filter(Boolean).join(" ");
    }

    try {
      await finishWorkout(workoutLogId, aiInsight);
    } catch {
      enqueueFinishWorkout(workoutLogId, aiInsight);
    }

    setIsFinishing(false);

    if (isRealWorkoutLog) {
      router.push(`/historial/${workoutLogId}`);
    } else {
      router.push("/historial");
    }
  }

  return {
    user,
    isSessionLoading,
    isLoading,
    error,
    successMessage,
    routine,
    routineExercises,
    workoutLogId,
    startTime,
    inputs,
    setLogs,
    suggestions,
    isStarting,
    isSavingSet,
    isFinishing,
    substitutingItemId,
    substituteOptions,
    isLoadingSubstitutes,
    isSubstituting,
    restSecondsLeft,
    setRestSecondsLeft,
    completedExerciseIds,
    showRegeneratePanel,
    setShowRegeneratePanel,
    regenerateInstructions,
    setRegenerateInstructions,
    isRegenerating,
    showReadinessModal,
    setShowReadinessModal,
    readinessForm,
    setReadinessForm,
    readinessGuidance,
    exerciseRefs,
    updateInput,
    aplicarSugerencia,
    aplicarTodasLasSugerencias,
    copiarSerieAnterior,
    ajustarPeso,
    ajustarReps,
    marcarCompletado,
    abrirSustitucion,
    cerrarSustitucion,
    sustituirEjercicio,
    regenerarDia,
    iniciarConReadiness,
    registrarSerie,
    finalizarEntrenamiento,
    isOnline,
    pendingSetIds,
    hasPendingOps: pendingSetIds.size > 0,
  };
}

export type WorkoutSession = ReturnType<typeof useWorkoutSession>;
