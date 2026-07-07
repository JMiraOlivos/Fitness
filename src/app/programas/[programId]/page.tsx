"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Save, Snowflake, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/SessionProvider";
import { authFetch } from "@/lib/authFetch";
import { detectFatigue } from "@/lib/training/fatigue";
import { classifyMesocyclePhase, MESOCYCLE_PHASE_TARGETS, shouldSuggestAdaptiveDeload } from "@/lib/training/mesocycle";

type Program = {
  id: string;
  name: string;
  focus: string | null;
  duration_weeks: number;
  days_per_week: number;
  deload_every_n_weeks: number | null;
};

type RoutineDay = {
  id: string;
  title: string;
  description: string | null;
  week_number: number | null;
  day_of_week: number | null;
  is_deload_week: boolean;
};

type EjercicioIA = {
  nombre: string;
  musculoObjetivo: string;
  equipamiento: string;
  seriesObjetivo: number;
  repeticionesObjetivo: string;
  notas: string;
};

type RutinaIA = {
  titulo: string;
  descripcion: string;
  ejercicios: EjercicioIA[];
};

export default function ProgramaDetallePage() {
  const params = useParams<{ programId: string }>();
  const programId = params.programId;
  const { user, isLoading: isSessionLoading } = useSession();

  const [program, setProgram] = useState<Program | null>(null);
  const [routines, setRoutines] = useState<RoutineDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [rutinasGeneradas, setRutinasGeneradas] = useState<RutinaIA[]>([]);
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [fatiguedExerciseCount, setFatiguedExerciseCount] = useState(0);
  const [weekAdherence, setWeekAdherence] = useState<{ planned: number; completed: number } | null>(null);
  const [forceDeload, setForceDeload] = useState(false);

  const loadPrograma = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const [programResult, routinesResult] = await Promise.all([
      supabase
        .from("programs")
        .select("id, name, focus, duration_weeks, days_per_week, deload_every_n_weeks")
        .eq("id", programId)
        .maybeSingle(),
      supabase
        .from("routines")
        .select("id, title, description, week_number, day_of_week, is_deload_week")
        .eq("program_id", programId)
        .order("week_number", { ascending: true })
        .order("day_of_week", { ascending: true }),
    ]);

    if (programResult.error) setError(programResult.error.message);
    else setProgram(programResult.data as Program | null);

    const routineRows = (routinesResult.data || []) as RoutineDay[];
    if (!routinesResult.error) setRoutines(routineRows);

    const routineIds = routineRows.map((routine) => routine.id);
    if (routineIds.length > 0) {
      await loadSignals(routineIds, routineRows);
    }

    setIsLoading(false);
  }, [programId]);

  // Fatigue/adherence signals for the adaptive deload suggestion (Fase vNext 8):
  // scoped to this program's own routines/workouts, not the user's whole history.
  async function loadSignals(routineIds: string[], routineRows: RoutineDay[]) {
    const { data: workoutLogs } = await supabase
      .from("workout_logs")
      .select("id, routine_id, start_time, end_time")
      .in("routine_id", routineIds)
      .order("start_time", { ascending: false })
      .limit(20);

    const recentLogs = workoutLogs || [];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const completedThisWeek = recentLogs.filter(
      (log) => log.end_time !== null && new Date(log.start_time) >= sevenDaysAgo
    ).length;
    const latestWeek = routineRows.length > 0 ? Math.max(...routineRows.map((routine) => routine.week_number ?? 0)) : 0;
    const daysThisWeek = routineRows.filter((routine) => routine.week_number === latestWeek).length;
    setWeekAdherence(daysThisWeek > 0 ? { planned: daysThisWeek, completed: completedThisWeek } : null);

    const workoutLogIds = recentLogs.map((log) => log.id);
    if (workoutLogIds.length === 0) {
      setFatiguedExerciseCount(0);
      return;
    }

    const { data: setLogs } = await supabase
      .from("set_logs")
      .select("workout_log_id, exercise_id, weight, reps, rpe, is_warmup, workout_logs!inner(start_time)")
      .in("workout_log_id", workoutLogIds);

    type SessionAgg = { date: string; volume: number; rpeSum: number; rpeCount: number };
    const sessionsByExercise = new Map<string, Map<string, SessionAgg>>();

    for (const row of (setLogs || []) as unknown as {
      workout_log_id: string;
      exercise_id: string;
      weight: number;
      reps: number;
      rpe: number | null;
      is_warmup: boolean;
      workout_logs: { start_time: string } | { start_time: string }[] | null;
    }[]) {
      if (row.is_warmup) continue;
      const workout = Array.isArray(row.workout_logs) ? row.workout_logs[0] : row.workout_logs;
      if (!workout?.start_time) continue;

      const exerciseSessions = sessionsByExercise.get(row.exercise_id) || new Map<string, SessionAgg>();
      const session = exerciseSessions.get(row.workout_log_id) || { date: workout.start_time, volume: 0, rpeSum: 0, rpeCount: 0 };

      session.volume += Number(row.weight || 0) * Number(row.reps || 0);
      if (row.rpe !== null) {
        session.rpeSum += Number(row.rpe);
        session.rpeCount += 1;
      }

      exerciseSessions.set(row.workout_log_id, session);
      sessionsByExercise.set(row.exercise_id, exerciseSessions);
    }

    let fatigued = 0;
    for (const exerciseSessions of sessionsByExercise.values()) {
      const ordered = Array.from(exerciseSessions.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((session) => ({ volume: session.volume, averageRpe: session.rpeCount > 0 ? session.rpeSum / session.rpeCount : null }));

      if (detectFatigue(ordered).isFatigued) fatigued += 1;
    }

    setFatiguedExerciseCount(fatigued);
  }

  useEffect(() => {
    if (isSessionLoading || !user) return;
    void loadPrograma();
  }, [user, isSessionLoading, loadPrograma]);

  const weeks = useMemo(() => {
    const grouped = new Map<number, RoutineDay[]>();
    routines.forEach((routine) => {
      const week = routine.week_number ?? 0;
      grouped.set(week, [...(grouped.get(week) || []), routine]);
    });
    return [...grouped.entries()].sort(([a], [b]) => a - b);
  }, [routines]);

  const currentWeek = weeks.length > 0 ? Math.max(...weeks.map(([week]) => week)) : 0;
  const nextWeek = currentWeek + 1;
  const programComplete = program ? nextWeek > program.duration_weeks : false;
  const nextWeekPhase =
    program && !programComplete ? classifyMesocyclePhase(nextWeek, program.duration_weeks, program.deload_every_n_weeks) : null;
  const nextWeekIsDeload = nextWeekPhase === "deload";
  const adaptiveDeload = shouldSuggestAdaptiveDeload({ fatiguedExerciseCount, adherence: weekAdherence });
  const canSuggestForceDeload = !programComplete && !nextWeekIsDeload && adaptiveDeload.suggest;

  async function generarSemana() {
    if (!program || !nextWeekPhase) return;

    setError(null);
    setIsGenerating(true);
    setRutinasGeneradas([]);
    setSavedIndexes(new Set());

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const response = await fetch("/api/ai/generar-rutina", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          diasDisponibles: program.days_per_week,
          enfoque: program.focus || "Hipertrofia",
          programaContexto: {
            nombre: program.name,
            semanaActual: nextWeek,
            semanasTotales: program.duration_weeks,
            fase: forceDeload ? "deload" : nextWeekPhase,
          },
        }),
      });

      const generado = (await response.json()) as { rutinas?: RutinaIA[]; error?: string };
      if (!response.ok) throw new Error(generado.error || "No se pudo generar la semana.");

      setRutinasGeneradas(generado.rutinas || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function guardarDia(rutina: RutinaIA, index: number) {
    setError(null);
    setSavingIndex(index);

    try {
      await authFetch("/api/routines/save", {
        rutina: {
          ...rutina,
          programaId: programId,
          numeroSemana: nextWeek,
          diaSemana: index + 1,
          ...(forceDeload ? { forzarDescarga: true } : {}),
        },
      });

      setSavedIndexes((current) => new Set(current).add(index));
      await loadPrograma();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el día.");
    } finally {
      setSavingIndex(null);
    }
  }

  if (isSessionLoading || (user && isLoading)) {
    return (
      <main className="min-h-screen bg-black text-white p-6 pb-28 font-sans max-w-md mx-auto">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center mt-10">
          <Loader2 className="h-8 w-8 animate-spin text-[#CCFF00] mx-auto" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-28 font-sans max-w-md mx-auto">
      <Link href="/programas" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <ArrowLeft className="h-4 w-4" /> Programas
      </Link>

      {error && <div className="mb-6 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>}

      {!program && !isLoading && (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Programa no encontrado</h2>
        </section>
      )}

      {program && (
        <>
          <header className="mb-6">
            <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Mesociclo</p>
            <h1 className="text-3xl font-black tracking-tight mt-1">{program.name}</h1>
            {program.focus && <p className="text-sm text-zinc-400 mt-2">{program.focus}</p>}
            <p className="text-xs text-zinc-500 mt-2">
              Semana {currentWeek} de {program.duration_weeks} · {program.days_per_week} días/semana
            </p>
          </header>

          {!programComplete && rutinasGeneradas.length === 0 && (
            <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="font-black">Semana {nextWeek}</p>
              {nextWeekPhase && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-blue-300">
                  {nextWeekIsDeload && <Snowflake className="h-3 w-3" />}
                  Fase: {MESOCYCLE_PHASE_TARGETS[forceDeload ? "deload" : nextWeekPhase].label}
                </p>
              )}

              {canSuggestForceDeload && (
                <div className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="inline-flex items-start gap-2 text-xs text-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    {adaptiveDeload.reason} ¿Tratar la semana {nextWeek} como deload aunque no toque por calendario?
                  </p>
                  <label className="mt-2 flex items-center gap-2 text-xs font-bold text-zinc-300">
                    <input
                      type="checkbox"
                      checked={forceDeload}
                      onChange={(event) => setForceDeload(event.target.checked)}
                      className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-[#CCFF00]"
                    />
                    Sí, tratar la semana {nextWeek} como deload
                  </label>
                </div>
              )}

              <button
                onClick={generarSemana}
                disabled={isGenerating}
                className="mt-4 w-full rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                Generar semana {nextWeek}
              </button>
            </section>
          )}

          {programComplete && (
            <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5 text-center">
              <p className="font-black">Programa completo</p>
              <p className="text-xs text-zinc-500 mt-1">Ya generaste todas las semanas de este mesociclo.</p>
            </section>
          )}

          {rutinasGeneradas.length > 0 && (
            <section className="mb-6 grid gap-3">
              {rutinasGeneradas.map((rutina, index) => (
                <div key={index} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
                  <p className="font-black">{rutina.titulo}</p>
                  <p className="text-xs text-zinc-500 mt-1">{rutina.descripcion}</p>
                  <button
                    onClick={() => guardarDia(rutina, index)}
                    disabled={savingIndex === index || savedIndexes.has(index)}
                    className="mt-4 w-full rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {savingIndex === index ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : savedIndexes.has(index) ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Save className="h-5 w-5" />
                    )}
                    {savedIndexes.has(index) ? "Guardado" : "Guardar día"}
                  </button>
                </div>
              ))}
            </section>
          )}

          <section className="grid gap-4">
            {weeks.map(([week, days]) => (
              <div key={week}>
                <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider mb-2">
                  Semana {week}
                  {days.some((day) => day.is_deload_week) ? " · Deload" : ""}
                </p>
                <div className="grid gap-2">
                  {days.map((day) => (
                    <Link
                      key={day.id}
                      href={`/entrenar/${day.id}`}
                      className="block rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                    >
                      <p className="font-bold">{day.title}</p>
                      {day.description && <p className="text-xs text-zinc-500 mt-1">{day.description}</p>}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
