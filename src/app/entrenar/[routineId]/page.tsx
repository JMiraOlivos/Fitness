"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, CheckCircle, Dumbbell, Loader2, Play, Plus, Repeat, Sparkles, Square, Timer, Wand2, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { one } from "@/lib/supabaseJoins";
import { useSession } from "@/components/SessionProvider";
import { authFetch } from "@/lib/authFetch";
import { recommendNextSet } from "@/lib/training/progression";

type ExerciseRow = {
  id: string;
  name: string;
  target_muscle: string;
  equipment: string;
};

type RoutineExerciseRow = {
  id: string;
  order_index: number;
  target_sets: number | null;
  target_reps: string | null;
  notes: string | null;
  exercises?: ExerciseRow | ExerciseRow[] | null;
};

type RoutineRow = {
  id: string;
  title: string;
  description: string | null;
  is_deload_week: boolean | null;
  routine_exercises?: RoutineExerciseRow[];
};

type SetInput = {
  weight: string;
  reps: string;
  rpe: string;
  isWarmup: boolean;
};

type LocalSetLog = {
  id: string;
  set_number: number;
  weight: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
};

type WorkoutInsightResponse = {
  insight?: string;
  focoProximoEntrenamiento?: string;
  alerta?: string;
  score?: number;
  error?: string;
};

type HistorySetRow = {
  exercise_id: string;
  workout_log_id: string;
  weight: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  created_at: string;
};

type ExerciseSuggestion = {
  lastWeight: number;
  lastReps: number;
  lastRpe: number | null;
  lastDate: string;
  suggestedWeight: number;
  suggestionLabel: string;
};

const REST_DURATION_SECONDS = 90;

function formatRestTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function defaultInput(): SetInput {
  return {
    weight: "",
    reps: "",
    rpe: "8",
    isWarmup: false,
  };
}

// Warmup sets are logged but excluded from volume/1RM/RPE-average so they don't
// understate how hard the working sets actually were.
function getVolume(logs: LocalSetLog[]) {
  return logs
    .filter((log) => !log.is_warmup)
    .reduce((sum, log) => sum + log.weight * log.reps, 0);
}

function getAverageRpe(logs: LocalSetLog[]) {
  const rpeLogs = logs.filter((log) => !log.is_warmup && log.rpe !== null);
  if (rpeLogs.length === 0) return null;
  return rpeLogs.reduce((sum, log) => sum + Number(log.rpe || 0), 0) / rpeLogs.length;
}

function buildSuggestion(sessionRows: HistorySetRow[], isDeloadWeek: boolean): ExerciseSuggestion | null {
  const workingRows = sessionRows.filter((row) => !row.is_warmup);
  if (workingRows.length === 0) return null;

  const lastSet = workingRows[0];
  const maxWeight = workingRows.reduce((max, row) => Math.max(max, row.weight), 0);
  const rpeValues = workingRows.filter((row) => row.rpe !== null).map((row) => row.rpe as number);
  const averageRpe = rpeValues.length > 0 ? rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length : null;

  // Exercise priority (principal/accesorio/aislamiento) isn't in the schema yet
  // (ROADMAP.md, Fase vNext 1) — defaults to "principal" until that lands.
  const recommendation = recommendNextSet({
    lastSession: { maxWeight, lastReps: lastSet.reps, averageRpe },
    isDeloadWeek,
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

function formatRelativeDate(value: string) {
  return new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

export default function EntrenarPage() {
  const params = useParams<{ routineId: string }>();
  const router = useRouter();
  const routineId = params.routineId;

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
  const exerciseRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (restSecondsLeft === null || restSecondsLeft <= 0) return;

    const timeout = setTimeout(() => {
      setRestSecondsLeft((current) => (current !== null ? current - 1 : null));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [restSecondsLeft]);

  const routineExercises = useMemo(() => {
    return [...(routine?.routine_exercises || [])].sort((a, b) => a.order_index - b.order_index);
  }, [routine]);

  const cargarSugerencias = useCallback(async (userId: string, exerciseIds: string[], isDeloadWeek: boolean) => {
    const { data: historyRows, error: historyError } = await supabase
      .from("set_logs")
      .select("exercise_id, workout_log_id, weight, reps, rpe, is_warmup, created_at, workout_logs!inner(user_id)")
      .in("exercise_id", exerciseIds)
      .eq("workout_logs.user_id", userId)
      .order("created_at", { ascending: false });

    if (historyError || !historyRows) {
      return;
    }

    const lastWorkoutByExercise: Record<string, string> = {};
    const sessionsByExercise: Record<string, HistorySetRow[]> = {};

    for (const row of historyRows as unknown as HistorySetRow[]) {
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
      const suggestion = buildSuggestion(sessionsByExercise[exerciseId], isDeloadWeek);
      if (suggestion) {
        nextSuggestions[exerciseId] = suggestion;
      }
    }

    setSuggestions(nextSuggestions);
  }, []);

  const cargarRutina = useCallback(
    async (userId: string) => {
      setIsLoading(true);
      setError(null);

      const { data, error: routineError } = await supabase
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

      if (routineError) {
        setError(routineError.message);
        setIsLoading(false);
        return;
      }

      const loadedRoutine = data as unknown as RoutineRow;
      setRoutine(loadedRoutine);

      const exerciseIds = (loadedRoutine.routine_exercises || [])
        .map((item) => one(item.exercises)?.id)
        .filter((id): id is string => Boolean(id));

      if (exerciseIds.length > 0) {
        await cargarSugerencias(userId, exerciseIds, Boolean(loadedRoutine.is_deload_week));
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

    const { data, error: loadError } = await supabase
      .from("exercises")
      .select("id, name, target_muscle, equipment")
      .eq("target_muscle", exercise.target_muscle)
      .is("owner_id", null)
      .neq("id", exercise.id)
      .order("name")
      .limit(20);

    setIsLoadingSubstitutes(false);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setSubstituteOptions((data || []) as ExerciseRow[]);
  }

  function cerrarSustitucion() {
    setSubstitutingItemId(null);
    setSubstituteOptions([]);
  }

  async function sustituirEjercicio(item: RoutineExerciseRow, nuevoEjercicio: ExerciseRow) {
    setIsSubstituting(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("routine_exercises")
      .update({ exercise_id: nuevoEjercicio.id })
      .eq("id", item.id);

    setIsSubstituting(false);

    if (updateError) {
      setError(updateError.message);
      return;
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
  }

  async function regenerarDia() {
    if (!user) return;

    setError(null);
    setSuccessMessage(null);
    setIsRegenerating(true);

    try {
      await authFetch("/api/ai/regenerar-dia", { routineId, instrucciones: regenerateInstructions });

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

    let data: { id: string; startTime: string | null };

    try {
      data = await authFetch<{ id: string; startTime: string | null }>("/api/workouts/start", { routineId: routine.id });
    } finally {
      setIsStarting(false);
    }

    setWorkoutLogId(data.id);
    setStartTime(data.startTime ? new Date(data.startTime) : new Date());
    setSuccessMessage("Entrenamiento iniciado.");

    return data.id;
  }

  async function iniciarEntrenamiento() {
    setError(null);
    setSuccessMessage(null);

    try {
      await ensureWorkoutLog();
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

      const data = await authFetch<{ id: string; set_number: number; weight: number; reps: number; rpe: number | null; is_warmup: boolean }>(
        "/api/workouts/log-set",
        {
          workoutLogId: logId,
          exerciseId: exercise.id,
          setNumber,
          weight,
          reps,
          rpe,
          isWarmup,
        }
      );

      const savedSet: LocalSetLog = {
        id: data.id,
        set_number: Number(data.set_number),
        weight: Number(data.weight),
        reps: Number(data.reps),
        rpe: data.rpe === null ? null : Number(data.rpe),
        is_warmup: Boolean(data.is_warmup),
      };

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

      setSuccessMessage(`Serie ${setNumber} registrada para ${exercise.name}.`);
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

    try {
      // Best-effort: attach the access token so the route can pull each exercise's
      // trend across prior sessions; still works without one.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const response = await fetch("/api/ai/analizar-entrenamiento", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          routineTitle: routine?.title,
          routineDescription: routine?.description,
          totalSets,
          totalVolume,
          averageRpe,
          startedAt: startTime?.toISOString(),
          finishedAt: new Date().toISOString(),
          workoutLogId,
          exerciseSummaries,
        }),
      });

      if (!response.ok) {
        return fallbackInsight;
      }

      const data = (await response.json()) as WorkoutInsightResponse;

      if (!data.insight) {
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
    } catch {
      return fallbackInsight;
    }
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
    const totalVolume = Object.values(setLogs).reduce((sum, logs) => sum + getVolume(logs), 0);

    if (allLoggedSets.length === 0) {
      setIsFinishing(false);
      setError("Registra al menos una serie antes de finalizar.");
      return;
    }

    const aiInsight = await generarInsightEntrenamiento(totalSets, totalVolume);

    try {
      await authFetch("/api/workouts/finish", { workoutLogId, aiInsight });
    } catch (err) {
      setIsFinishing(false);
      setError(err instanceof Error ? err.message : "No se pudo finalizar el entrenamiento.");
      return;
    }

    setIsFinishing(false);
    router.push(`/historial/${workoutLogId}`);
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-black text-white p-6 max-w-md mx-auto flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#CCFF00]" />
          <p className="mt-3 text-sm text-zinc-400">Cargando entrenamiento...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-black text-white p-6 max-w-md mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-8">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h1 className="text-2xl font-black">Inicia sesión</h1>
          <p className="mt-2 text-sm text-zinc-400">Debes iniciar sesión desde el dashboard para registrar entrenamientos y guardar series.</p>
          <Link href="/" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">
            Ir al dashboard
          </Link>
        </section>
      </main>
    );
  }

  if (!routine) {
    return (
      <main className="min-h-screen bg-black text-white p-6 max-w-md mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-8">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <section className="rounded-3xl border border-red-900/60 bg-red-950/30 p-5">
          <h1 className="text-2xl font-black">Rutina no encontrada</h1>
          <p className="mt-2 text-sm text-red-200">{error || "No pudimos cargar esta rutina."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-28 font-sans max-w-md mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Entrenamiento activo</p>
            <h1 className="text-3xl font-black tracking-tight mt-1">{routine.title}</h1>
            <p className="text-sm text-zinc-400 mt-2">{routine.description || "Registra peso, repeticiones y RPE por serie."}</p>
            {routine.is_deload_week && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase text-amber-300">
                Semana de deload · sin PRs, ~10% menos de carga
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowRegeneratePanel((current) => !current)}
            disabled={Boolean(workoutLogId)}
            title={workoutLogId ? "Finaliza o descarta el entrenamiento en curso para regenerar el día" : undefined}
            className="shrink-0 rounded-full bg-zinc-900 p-3 text-[#CCFF00] disabled:opacity-30"
            aria-label="Regenerar día con IA"
          >
            <Wand2 className="h-5 w-5" />
          </button>
        </div>

        {showRegeneratePanel && (
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs uppercase font-bold text-zinc-400 mb-2">Regenerar este día con IA</p>
            <p className="text-xs text-zinc-500 mb-3">Reemplaza los ejercicios de este día. El título y la rutina se mantienen en la misma URL.</p>
            <textarea
              value={regenerateInstructions}
              onChange={(event) => setRegenerateInstructions(event.target.value)}
              rows={2}
              placeholder="Opcional: ej. más énfasis en espalda, evitar sentadilla"
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-[#CCFF00] resize-none"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={isRegenerating}
                onClick={() => void regenerarDia()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#CCFF00] py-2 text-sm font-black text-black disabled:opacity-50"
              >
                {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {isRegenerating ? "Regenerando..." : "Regenerar"}
              </button>
              <button
                type="button"
                onClick={() => setShowRegeneratePanel(false)}
                className="flex-1 rounded-2xl bg-zinc-900 py-2 text-sm font-bold text-zinc-300"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </header>

      {restSecondsLeft !== null && (
        <div className="fixed bottom-20 left-0 right-0 z-40 mx-auto max-w-md px-6">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#CCFF00]/40 bg-black/95 p-4 shadow-lg shadow-black/50 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-[#CCFF00]" />
              <div>
                <p className="text-[10px] uppercase font-bold text-zinc-400">Descanso</p>
                <p className="text-xl font-black">{restSecondsLeft > 0 ? formatRestTime(restSecondsLeft) : "¡Listo!"}</p>
              </div>
            </div>
            <button type="button" onClick={() => setRestSecondsLeft(null)} className="rounded-full bg-zinc-900 p-2 text-zinc-400">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs text-zinc-500 uppercase font-bold">Estado</p>
          <p className="mt-1 text-lg font-black">{workoutLogId ? "En curso" : "Sin iniciar"}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs text-zinc-500 uppercase font-bold">Inicio</p>
          <p className="mt-1 text-lg font-black">{startTime ? startTime.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "--:--"}</p>
        </div>
      </section>

      {routineExercises.length > 0 && (
        <section className="mb-6">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-bold text-zinc-300">Progreso de la rutina</span>
            <span className="text-zinc-500">
              {completedExerciseIds.size}/{routineExercises.length} ejercicios
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full bg-[#CCFF00] transition-all"
              style={{ width: `${Math.round((completedExerciseIds.size / routineExercises.length) * 100)}%` }}
            />
          </div>
        </section>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3">
        <button
          onClick={iniciarEntrenamiento}
          disabled={Boolean(workoutLogId) || isStarting}
          className="rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black inline-flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {isStarting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
          Iniciar
        </button>
        <button
          onClick={finalizarEntrenamiento}
          disabled={!workoutLogId || isFinishing}
          className="rounded-2xl bg-zinc-900 px-4 py-3 font-black text-white inline-flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {isFinishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Square className="h-5 w-5" />}
          {isFinishing ? "Analizando..." : "Finalizar"}
        </button>
      </section>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-6 rounded-2xl border border-lime-900/60 bg-lime-950/40 p-4 text-sm text-lime-200 inline-flex gap-2">
          <CheckCircle2 className="h-5 w-5 shrink-0" /> {successMessage}
        </div>
      )}

      <section className="grid gap-4">
        {routineExercises.map((item) => {
          const exercise = one(item.exercises);
          const currentInput = inputs[item.id] || defaultInput();
          const localLogs = exercise?.id ? setLogs[exercise.id] || [] : [];
          const suggestion = exercise?.id ? suggestions[exercise.id] : undefined;
          const isCompleted = completedExerciseIds.has(item.id);

          return (
            <article
              key={item.id}
              ref={(el) => {
                exerciseRefs.current[item.id] = el;
              }}
              className={`rounded-3xl border p-4 transition-opacity ${
                isCompleted ? "border-zinc-800 bg-zinc-950/60 opacity-60" : "border-zinc-800 bg-zinc-950"
              }`}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[#CCFF00] font-bold uppercase">Ejercicio {item.order_index}</p>
                  <h2 className="text-xl font-black">{exercise?.name || "Ejercicio"}</h2>
                  <p className="text-xs text-zinc-500 mt-1">{exercise?.target_muscle || "Músculo"} • {exercise?.equipment || "Equipo"}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => marcarCompletado(item.id)}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-400"
                  >
                    {isCompleted ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-[#CCFF00]" /> Completado
                      </>
                    ) : (
                      <Dumbbell className="h-5 w-5 text-[#CCFF00]" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => (substitutingItemId === item.id ? cerrarSustitucion() : void abrirSustitucion(item))}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-400"
                  >
                    <Repeat className="h-3 w-3" /> Sustituir
                  </button>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-zinc-900 p-3">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">Series</p>
                  <p className="font-black">{item.target_sets || 3}</p>
                </div>
                <div className="rounded-2xl bg-zinc-900 p-3">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">Reps</p>
                  <p className="font-black">{item.target_reps || "10-12"}</p>
                </div>
                <div className="rounded-2xl bg-zinc-900 p-3">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">Hechas</p>
                  <p className="font-black">{localLogs.length}</p>
                </div>
              </div>

              {item.notes && <p className="mb-4 text-xs text-zinc-400">{item.notes}</p>}

              {substitutingItemId === item.id && (
                <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
                  <p className="text-[10px] uppercase font-bold text-zinc-400 mb-2">
                    Sustituir por otro ejercicio de {exercise?.target_muscle || "este grupo muscular"}
                  </p>

                  {isLoadingSubstitutes && <Loader2 className="h-5 w-5 animate-spin text-[#CCFF00] mx-auto my-2" />}

                  {!isLoadingSubstitutes && substituteOptions.length === 0 && (
                    <p className="text-xs text-zinc-500">No hay otros ejercicios registrados para este grupo muscular.</p>
                  )}

                  {!isLoadingSubstitutes && substituteOptions.length > 0 && (
                    <div className="grid gap-2">
                      {substituteOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          disabled={isSubstituting}
                          onClick={() => void sustituirEjercicio(item, option)}
                          className="flex items-center justify-between rounded-xl bg-zinc-950 px-3 py-2 text-left text-xs disabled:opacity-50"
                        >
                          <span className="font-bold text-white">{option.name}</span>
                          <span className="text-zinc-500">{option.equipment}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <button type="button" onClick={cerrarSustitucion} className="mt-2 text-xs font-bold text-zinc-500">
                    Cancelar
                  </button>
                </div>
              )}

              {suggestion && (
                <div className="mb-4 rounded-2xl border border-[#CCFF00]/30 bg-[#CCFF00]/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[#CCFF00] inline-flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Última vez ({formatRelativeDate(suggestion.lastDate)})
                      </p>
                      <p className="mt-1 text-sm font-bold text-white">
                        {suggestion.lastWeight} kg × {suggestion.lastReps} reps
                        {suggestion.lastRpe ? ` · RPE ${suggestion.lastRpe}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">{suggestion.suggestionLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => aplicarSugerencia(item.id, suggestion)}
                      className="shrink-0 rounded-xl bg-[#CCFF00] px-3 py-2 text-xs font-black text-black"
                    >
                      Usar {suggestion.suggestedWeight} kg
                    </button>
                  </div>
                </div>
              )}

              {localLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => copiarSerieAnterior(item.id, localLogs[localLogs.length - 1])}
                  className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-zinc-400"
                >
                  <Repeat className="h-3 w-3" /> Copiar serie anterior
                </button>
              )}

              <div className="grid grid-cols-3 gap-2">
                <label className="grid gap-1 text-xs text-zinc-400">
                  Peso
                  <input
                    value={currentInput.weight}
                    onChange={(event) => updateInput(item.id, { weight: event.target.value })}
                    inputMode="decimal"
                    placeholder="kg"
                    className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
                  />
                </label>
                <label className="grid gap-1 text-xs text-zinc-400">
                  Reps
                  <input
                    value={currentInput.reps}
                    onChange={(event) => updateInput(item.id, { reps: event.target.value })}
                    inputMode="numeric"
                    placeholder="10"
                    className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
                  />
                </label>
                <label className="grid gap-1 text-xs text-zinc-400">
                  RPE
                  <input
                    value={currentInput.rpe}
                    onChange={(event) => updateInput(item.id, { rpe: event.target.value })}
                    inputMode="decimal"
                    placeholder="8 o 8.5"
                    className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
                  />
                </label>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => ajustarPeso(item.id, -2.5)}
                    className="flex-1 rounded-xl bg-zinc-900 py-2 text-xs font-bold text-zinc-300"
                  >
                    -2.5
                  </button>
                  <button
                    type="button"
                    onClick={() => ajustarPeso(item.id, 2.5)}
                    className="flex-1 rounded-xl bg-zinc-900 py-2 text-xs font-bold text-zinc-300"
                  >
                    +2.5
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => ajustarReps(item.id, 1)}
                  className="rounded-xl bg-zinc-900 py-2 text-xs font-bold text-zinc-300"
                >
                  +1 rep
                </button>
                <div />
              </div>

              <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  checked={currentInput.isWarmup}
                  onChange={(event) => updateInput(item.id, { isWarmup: event.target.checked })}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-[#CCFF00]"
                />
                Serie de calentamiento (no cuenta en volumen/1RM/RPE)
              </label>

              <button
                onClick={() => registrarSerie(item)}
                disabled={isSavingSet}
                className="mt-3 w-full rounded-2xl bg-white px-4 py-3 font-black text-black inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSavingSet ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                Registrar serie
              </button>

              {localLogs.length > 0 && (
                <div className="mt-4 grid gap-2">
                  {localLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between rounded-xl bg-zinc-900 px-3 py-2 text-xs">
                      <span className="text-zinc-400">
                        Serie {log.set_number} {log.is_warmup && <span className="text-[#CCFF00]">· Calentamiento</span>}
                      </span>
                      <span className="font-bold text-white">{log.weight} kg × {log.reps} reps {log.rpe ? `• RPE ${log.rpe}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
