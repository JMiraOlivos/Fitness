"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Dumbbell, Loader2, Play, Plus, Sparkles, Square } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { one } from "@/lib/supabaseJoins";
import { useSession } from "@/components/SessionProvider";

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
  routine_exercises?: RoutineExerciseRow[];
};

type SetInput = {
  weight: string;
  reps: string;
  rpe: string;
};

type LocalSetLog = {
  id: string;
  set_number: number;
  weight: number;
  reps: number;
  rpe: number | null;
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

function defaultInput(): SetInput {
  return {
    weight: "",
    reps: "",
    rpe: "8",
  };
}

function getVolume(logs: LocalSetLog[]) {
  return logs.reduce((sum, log) => sum + log.weight * log.reps, 0);
}

function getAverageRpe(logs: LocalSetLog[]) {
  const rpeLogs = logs.filter((log) => log.rpe !== null);
  if (rpeLogs.length === 0) return null;
  return rpeLogs.reduce((sum, log) => sum + Number(log.rpe || 0), 0) / rpeLogs.length;
}

function buildSuggestion(sessionRows: HistorySetRow[]): ExerciseSuggestion | null {
  if (sessionRows.length === 0) return null;

  const lastSet = sessionRows[0];
  const maxWeight = sessionRows.reduce((max, row) => Math.max(max, row.weight), 0);
  const rpeValues = sessionRows.filter((row) => row.rpe !== null).map((row) => row.rpe as number);
  const averageRpe = rpeValues.length > 0 ? rpeValues.reduce((sum, rpe) => sum + rpe, 0) / rpeValues.length : null;

  let suggestedWeight = maxWeight;
  let suggestionLabel = "Repite el peso, ajusta reps si puedes.";

  if (averageRpe !== null) {
    if (averageRpe <= 7) {
      suggestedWeight = maxWeight + 2.5;
      suggestionLabel = `RPE ${averageRpe.toFixed(1)} bajo. Sube +2.5 kg.`;
    } else if (averageRpe >= 9) {
      suggestedWeight = maxWeight;
      suggestionLabel = `RPE ${averageRpe.toFixed(1)} alto. Mantén el peso.`;
    } else {
      suggestionLabel = `RPE ${averageRpe.toFixed(1)}. Mantén el peso, busca más reps.`;
    }
  }

  return {
    lastWeight: lastSet.weight,
    lastReps: lastSet.reps,
    lastRpe: lastSet.rpe,
    lastDate: lastSet.created_at,
    suggestedWeight,
    suggestionLabel,
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

  const routineExercises = useMemo(() => {
    return [...(routine?.routine_exercises || [])].sort((a, b) => a.order_index - b.order_index);
  }, [routine]);

  useEffect(() => {
    if (isSessionLoading) return;

    if (!user) {
      setIsLoading(false);
      return;
    }

    const userId = user.id;

    async function bootstrap() {
      setIsLoading(true);
      setError(null);

      const { data, error: routineError } = await supabase
        .from("routines")
        .select(`
          id,
          title,
          description,
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
        await cargarSugerencias(userId, exerciseIds);
      }

      setIsLoading(false);
    }

    async function cargarSugerencias(userId: string, exerciseIds: string[]) {
      const { data: historyRows, error: historyError } = await supabase
        .from("set_logs")
        .select("exercise_id, workout_log_id, weight, reps, rpe, created_at, workout_logs!inner(user_id)")
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
        const suggestion = buildSuggestion(sessionsByExercise[exerciseId]);
        if (suggestion) {
          nextSuggestions[exerciseId] = suggestion;
        }
      }

      setSuggestions(nextSuggestions);
    }

    void bootstrap();
  }, [routineId, user, isSessionLoading]);

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

    const { data, error: insertError } = await supabase
      .from("workout_logs")
      .insert({
        user_id: user.id,
        routine_id: routine.id,
      })
      .select("id, start_time")
      .single();

    setIsStarting(false);

    if (insertError) {
      throw insertError;
    }

    if (!data?.id) {
      throw new Error("No se pudo iniciar el entrenamiento.");
    }

    setWorkoutLogId(data.id);
    setStartTime(data.start_time ? new Date(data.start_time as string) : new Date());
    setSuccessMessage("Entrenamiento iniciado.");

    return data.id as string;
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
      const rpe = currentInput.rpe ? Number.parseInt(currentInput.rpe, 10) : null;

      if (!Number.isFinite(weight) || weight < 0) {
        throw new Error("Ingresa un peso válido.");
      }

      if (!Number.isFinite(reps) || reps <= 0) {
        throw new Error("Ingresa repeticiones válidas.");
      }

      if (rpe !== null && (!Number.isFinite(rpe) || rpe < 1 || rpe > 10)) {
        throw new Error("El RPE debe estar entre 1 y 10.");
      }

      const logId = await ensureWorkoutLog();
      const setNumber = (setLogs[exercise.id]?.length || 0) + 1;

      const { data, error: insertError } = await supabase
        .from("set_logs")
        .insert({
          workout_log_id: logId,
          exercise_id: exercise.id,
          set_number: setNumber,
          weight,
          reps,
          rpe,
        })
        .select("id, set_number, weight, reps, rpe")
        .single();

      if (insertError) {
        throw insertError;
      }

      const savedSet: LocalSetLog = {
        id: data.id as string,
        set_number: Number(data.set_number),
        weight: Number(data.weight),
        reps: Number(data.reps),
        rpe: data.rpe === null ? null : Number(data.rpe),
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
        const logs = exercise?.id ? setLogs[exercise.id] || [] : [];

        return {
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
      const response = await fetch("/api/ai/analizar-entrenamiento", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routineTitle: routine?.title,
          routineDescription: routine?.description,
          totalSets,
          totalVolume,
          averageRpe,
          startedAt: startTime?.toISOString(),
          finishedAt: new Date().toISOString(),
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

    const totalSets = Object.values(setLogs).reduce((sum, logs) => sum + logs.length, 0);
    const totalVolume = Object.values(setLogs).reduce((sum, logs) => sum + getVolume(logs), 0);

    if (totalSets === 0) {
      setIsFinishing(false);
      setError("Registra al menos una serie antes de finalizar.");
      return;
    }

    const aiInsight = await generarInsightEntrenamiento(totalSets, totalVolume);

    const { error: updateError } = await supabase
      .from("workout_logs")
      .update({
        end_time: new Date().toISOString(),
        ai_insight: aiInsight,
      })
      .eq("id", workoutLogId);

    setIsFinishing(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

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
        <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Entrenamiento activo</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">{routine.title}</h1>
        <p className="text-sm text-zinc-400 mt-2">{routine.description || "Registra peso, repeticiones y RPE por serie."}</p>
      </header>

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

          return (
            <article key={item.id} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[#CCFF00] font-bold uppercase">Ejercicio {item.order_index}</p>
                  <h2 className="text-xl font-black">{exercise?.name || "Ejercicio"}</h2>
                  <p className="text-xs text-zinc-500 mt-1">{exercise?.target_muscle || "Músculo"} • {exercise?.equipment || "Equipo"}</p>
                </div>
                <Dumbbell className="h-5 w-5 text-[#CCFF00] shrink-0" />
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
                    inputMode="numeric"
                    placeholder="8"
                    className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
                  />
                </label>
              </div>

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
                      <span className="text-zinc-400">Serie {log.set_number}</span>
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
