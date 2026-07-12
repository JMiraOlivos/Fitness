"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Dumbbell, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { one } from "@/lib/supabaseJoins";
import { estimateOneRepMax } from "@/lib/oneRepMax";
import { useSession } from "@/components/SessionProvider";
import { classifyVolume, MUSCLE_GROUP_VOLUME_TARGETS, type VolumeStatus } from "@/lib/training/volumeTargets";
import { detectFatigue } from "@/lib/training/fatigue";
import { buildWeeklyRecommendations } from "@/lib/training/weeklyRecommendation";
import { analyzeMovementBalance } from "@/lib/training/movementBalance";
import { TrainingCalendar } from "@/components/TrainingCalendar";

type ReadinessRow = {
  created_at: string;
  energy: number;
  sleep_quality: number;
  soreness: number;
};

type ExerciseRef = {
  id: string;
  name: string;
  target_muscle: string;
  equipment: string;
};

type WorkoutRef = {
  start_time: string;
};

export type ProgresoSetLog = {
  id: string;
  workout_log_id: string;
  weight: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  exercises?: ExerciseRef | ExerciseRef[] | null;
  workout_logs?: WorkoutRef | WorkoutRef[] | null;
};

type SetLog = ProgresoSetLog;

type ExerciseProgress = {
  id: string;
  name: string;
  targetMuscle: string;
  equipment: string;
  sets: number;
  volume: number;
  maxWeight: number;
  maxReps: number;
  estimatedOneRepMax: number | null;
  lastDate: string;
};

function buildProgress(setLogs: SetLog[]) {
  const map = new Map<string, ExerciseProgress>();

  for (const setLog of setLogs) {
    if (setLog.is_warmup) continue;

    const exercise = one(setLog.exercises);
    const workout = one(setLog.workout_logs);

    if (!exercise?.id) continue;

    const current = map.get(exercise.id) || {
      id: exercise.id,
      name: exercise.name,
      targetMuscle: exercise.target_muscle,
      equipment: exercise.equipment,
      sets: 0,
      volume: 0,
      maxWeight: 0,
      maxReps: 0,
      estimatedOneRepMax: null,
      lastDate: workout?.start_time || "",
    };

    const weight = Number(setLog.weight || 0);
    const reps = Number(setLog.reps || 0);
    const oneRepMax = estimateOneRepMax(weight, reps);

    current.sets += 1;
    current.volume += weight * reps;
    current.maxWeight = Math.max(current.maxWeight, weight);
    current.maxReps = Math.max(current.maxReps, reps);
    if (oneRepMax !== null) {
      current.estimatedOneRepMax = Math.max(current.estimatedOneRepMax ?? 0, oneRepMax);
    }

    if (workout?.start_time && (!current.lastDate || new Date(workout.start_time) > new Date(current.lastDate))) {
      current.lastDate = workout.start_time;
    }

    map.set(exercise.id, current);
  }

  return Array.from(map.values()).sort((a, b) => b.volume - a.volume);
}

type MuscleGroupVolume = {
  muscleGroup: string;
  volume: number;
  sets: number;
};

function buildMuscleGroupWeeklyVolume(setLogs: SetLog[]) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const map = new Map<string, MuscleGroupVolume>();

  for (const setLog of setLogs) {
    if (setLog.is_warmup) continue;

    const exercise = one(setLog.exercises);
    const workout = one(setLog.workout_logs);

    if (!exercise?.target_muscle) continue;
    if (!workout?.start_time || new Date(workout.start_time) < sevenDaysAgo) continue;

    const current = map.get(exercise.target_muscle) || {
      muscleGroup: exercise.target_muscle,
      volume: 0,
      sets: 0,
    };

    current.volume += Number(setLog.weight || 0) * Number(setLog.reps || 0);
    current.sets += 1;
    map.set(exercise.target_muscle, current);
  }

  return Array.from(map.values()).sort((a, b) => b.volume - a.volume);
}

type ExerciseFatigue = {
  exerciseId: string;
  exerciseName: string;
  isFatigued: boolean;
};

type MutableSession = { date: string; volume: number; averageRpe: number | null; rpeSum: number; rpeCount: number };

// Groups working sets into per-workout-session summaries per exercise, then hands
// each exercise's session history (oldest -> newest) to detectFatigue().
function buildExerciseFatigue(setLogs: SetLog[]): ExerciseFatigue[] {
  const sessionsByExercise = new Map<string, { name: string; sessions: Map<string, MutableSession> }>();

  for (const setLog of setLogs) {
    if (setLog.is_warmup) continue;

    const exercise = one(setLog.exercises);
    const workout = one(setLog.workout_logs);
    if (!exercise?.id || !workout?.start_time) continue;

    const exerciseEntry = sessionsByExercise.get(exercise.id) || { name: exercise.name, sessions: new Map() };

    const session: MutableSession = exerciseEntry.sessions.get(setLog.workout_log_id) || {
      date: workout.start_time,
      volume: 0,
      averageRpe: null,
      rpeSum: 0,
      rpeCount: 0,
    };

    const weight = Number(setLog.weight || 0);
    const reps = Number(setLog.reps || 0);
    session.volume += weight * reps;

    if (setLog.rpe !== null) {
      session.rpeSum += Number(setLog.rpe);
      session.rpeCount += 1;
      session.averageRpe = session.rpeSum / session.rpeCount;
    }

    exerciseEntry.sessions.set(setLog.workout_log_id, session);
    sessionsByExercise.set(exercise.id, exerciseEntry);
  }

  const results: ExerciseFatigue[] = [];

  for (const [exerciseId, entry] of sessionsByExercise) {
    const orderedSessions = Array.from(entry.sessions.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((session) => ({ volume: session.volume, averageRpe: session.averageRpe }));

    const { isFatigued } = detectFatigue(orderedSessions);
    results.push({ exerciseId, exerciseName: entry.name, isFatigued });
  }

  return results;
}

function formatDate(value: string) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

const VOLUME_STATUS_LABELS: Record<VolumeStatus, string> = {
  bajo: "bajo",
  correcto: "correcto",
  alto: "alto",
  desconocido: "",
};

const VOLUME_STATUS_BAR_COLOR: Record<VolumeStatus, string> = {
  bajo: "bg-amber-400",
  correcto: "bg-[#CCFF00]",
  alto: "bg-red-500",
  desconocido: "bg-zinc-500",
};

export function ProgresoClient({ initialSetLogs }: { initialSetLogs?: SetLog[] | null }) {
  const { user, isLoading: isSessionLoading } = useSession();
  const [setLogs, setSetLogs] = useState<SetLog[]>(initialSetLogs ?? []);
  // If the Server Component already streamed the 90-day set_logs, we don't block on
  // the client fetch — only the smaller adherence/readiness queries remain.
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adherence, setAdherence] = useState<{ planned: number; completed: number } | null>(null);
  const [readinessTrend, setReadinessTrend] = useState<ReadinessRow[]>([]);

  const progress = useMemo(() => buildProgress(setLogs), [setLogs]);
  const movementBalance = useMemo(
    () => analyzeMovementBalance(buildMuscleGroupWeeklyVolume(setLogs).map((item) => ({ muscleGroup: item.muscleGroup, sets: item.sets }))),
    [setLogs]
  );
  const totalVolume = useMemo(() => progress.reduce((sum, item) => sum + item.volume, 0), [progress]);
  const totalSets = useMemo(() => progress.reduce((sum, item) => sum + item.sets, 0), [progress]);
  const topExercise = progress[0];
  const muscleGroupWeeklyVolume = useMemo(() => buildMuscleGroupWeeklyVolume(setLogs), [setLogs]);
  const maxMuscleGroupVolume = useMemo(
    () => Math.max(...muscleGroupWeeklyVolume.map((item) => item.volume), 1),
    [muscleGroupWeeklyVolume]
  );

  const exerciseFatigue = useMemo(() => buildExerciseFatigue(setLogs), [setLogs]);
  const fatiguedExerciseNames = useMemo(
    () => exerciseFatigue.filter((item) => item.isFatigued).map((item) => item.exerciseName),
    [exerciseFatigue]
  );
  const lowVolumeMuscleGroups = useMemo(
    () => muscleGroupWeeklyVolume.filter((item) => classifyVolume(item.muscleGroup, item.sets) === "bajo").map((item) => item.muscleGroup),
    [muscleGroupWeeklyVolume]
  );
  const highVolumeMuscleGroups = useMemo(
    () => muscleGroupWeeklyVolume.filter((item) => classifyVolume(item.muscleGroup, item.sets) === "alto").map((item) => item.muscleGroup),
    [muscleGroupWeeklyVolume]
  );
  const weeklyRecommendations = useMemo(
    () => buildWeeklyRecommendations({ lowVolumeMuscleGroups, highVolumeMuscleGroups, fatiguedExerciseNames, adherence }),
    [lowVolumeMuscleGroups, highVolumeMuscleGroups, fatiguedExerciseNames, adherence]
  );
  const fatiguedExerciseIds = useMemo(
    () => new Set(exerciseFatigue.filter((item) => item.isFatigued).map((item) => item.exerciseId)),
    [exerciseFatigue]
  );

  useEffect(() => {
    if (isSessionLoading) return;

    if (!user) {
      setIsLoading(false);
      return;
    }

    async function loadProgress() {
      setIsLoading(true);
      setError(null);

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // Skip the heavy set_logs fetch when the server already streamed it.
      if (!initialSetLogs) {
      const { data, error: loadError } = await supabase
        .from("set_logs")
        .select(`
          id,
          workout_log_id,
          weight,
          reps,
          rpe,
          is_warmup,
          exercises ( id, name, target_muscle, equipment ),
          workout_logs!inner ( start_time )
        `)
        .gte("workout_logs.start_time", ninetyDaysAgo.toISOString())
        .order("id", { ascending: false });

      if (loadError) {
        setError(loadError.message);
      } else {
        setSetLogs((data || []) as unknown as SetLog[]);
      }
      }

      const { data: program } = await supabase
        .from("programs")
        .select("days_per_week")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (program) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { count } = await supabase
          .from("workout_logs")
          .select("id", { count: "exact", head: true })
          .not("end_time", "is", null)
          .gte("start_time", sevenDaysAgo.toISOString());

        setAdherence({ planned: program.days_per_week, completed: count || 0 });
      } else {
        setAdherence(null);
      }

      const { data: readiness } = await supabase
        .from("readiness_logs")
        .select("created_at, energy, sleep_quality, soreness")
        .order("created_at", { ascending: false })
        .limit(14);
      setReadinessTrend((readiness || []) as unknown as ReadinessRow[]);

      setIsLoading(false);
    }

    void loadProgress();
  }, [user, isSessionLoading]);

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-16 font-sans max-w-md mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <header className="mb-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Progreso</p>
            <h1 className="text-3xl font-black tracking-tight mt-1">Por ejercicio</h1>
          </div>
          <Link href="/progreso/peso" className="shrink-0 rounded-full bg-zinc-900 px-3 py-2 text-xs font-bold text-zinc-300 border border-zinc-800">
            Peso corporal
          </Link>
        </div>
        <p className="text-sm text-zinc-400 mt-2">Resumen de los últimos 90 días con volumen, series y mejores marcas.</p>
      </header>

      {!user && !isLoading && (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Inicia sesión primero</h2>
          <p className="text-sm text-zinc-400 mt-2">Crea usuario o inicia sesión para revisar tu progreso.</p>
          <Link href="/auth" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">
            Ir a login
          </Link>
        </section>
      )}

      {isLoading && (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#CCFF00] mx-auto" />
          <p className="text-sm text-zinc-400 mt-3">Calculando progreso...</p>
        </div>
      )}

      {error && <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>}

      {user && !isLoading && <TrainingCalendar />}

      {user && !isLoading && weeklyRecommendations.length > 0 && (
        <section className="mb-8 rounded-3xl border border-[#CCFF00]/40 bg-[#CCFF00]/10 p-4">
          <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider inline-flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" /> Qué ajustar esta semana
          </p>
          <div className="mt-3 grid gap-2">
            {weeklyRecommendations.map((recommendation) => (
              <p key={recommendation} className="text-sm text-zinc-200">
                {recommendation}
              </p>
            ))}
          </div>
        </section>
      )}

      {user && !isLoading && readinessTrend.length >= 2 && (
        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Recuperación reciente</p>
          <p className="text-[11px] text-zinc-500 mt-1">Promedio de tus últimos {readinessTrend.length} check-ins de readiness (1-5).</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {([
              { key: "energy", label: "Energía", higherIsBetter: true },
              { key: "sleep_quality", label: "Sueño", higherIsBetter: true },
              { key: "soreness", label: "Dolor musc.", higherIsBetter: false },
            ] as const).map((metric) => {
              const avg = readinessTrend.reduce((sum, row) => sum + Number(row[metric.key] || 0), 0) / readinessTrend.length;
              const good = metric.higherIsBetter ? avg >= 3.5 : avg <= 2.5;
              const bad = metric.higherIsBetter ? avg <= 2 : avg >= 4;
              return (
                <div key={metric.key} className="rounded-2xl border border-zinc-800 bg-black p-3">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">{metric.label}</p>
                  <p className={`text-xl font-black mt-1 ${good ? "text-[#CCFF00]" : bad ? "text-red-400" : "text-white"}`}>{avg.toFixed(1)}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {user && !isLoading && movementBalance.ratios.some((ratio) => ratio.ratio !== null) && (
        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Balance de patrones (7 días)</p>
          <div className="mt-4 grid gap-3">
            {movementBalance.ratios.filter((ratio) => ratio.ratio !== null).map((ratio) => {
              const total = ratio.a.sets + ratio.b.sets || 1;
              const aPct = (ratio.a.sets / total) * 100;
              return (
                <div key={ratio.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-300">{ratio.a.label} <span className="text-zinc-500">{ratio.a.sets}</span></span>
                    <span className="font-bold text-zinc-300">{ratio.b.label} <span className="text-zinc-500">{ratio.b.sets}</span></span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-zinc-900">
                    <div className={`h-full ${ratio.warning ? "bg-amber-400" : "bg-[#CCFF00]"}`} style={{ width: `${aPct}%` }} />
                    <div className="h-full bg-zinc-600" style={{ width: `${100 - aPct}%` }} />
                  </div>
                </div>
              );
            })}
            {movementBalance.warnings.map((warning) => (
              <p key={warning} className="text-xs text-amber-300">{warning}</p>
            ))}
          </div>
        </section>
      )}

      {user && !isLoading && progress.length > 0 && (
        <section className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Ejercicios</p>
            <p className="text-xl font-black mt-1">{progress.length}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Series</p>
            <p className="text-xl font-black mt-1">{totalSets}</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Volumen</p>
            <p className="text-xl font-black mt-1">{Math.round(totalVolume)}</p>
          </div>
        </section>
      )}

      {user && !isLoading && muscleGroupWeeklyVolume.length > 0 && (
        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Volumen semanal por grupo muscular</p>
          <div className="mt-4 grid gap-3">
            {muscleGroupWeeklyVolume.map((item) => {
              const target = MUSCLE_GROUP_VOLUME_TARGETS[item.muscleGroup as keyof typeof MUSCLE_GROUP_VOLUME_TARGETS];
              const status = classifyVolume(item.muscleGroup, item.sets);

              return (
                <div key={item.muscleGroup}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-300">{item.muscleGroup}</span>
                    <span className="text-zinc-500">
                      {item.sets}
                      {target ? ` / ${target.min}-${target.max}` : ""} series
                      {VOLUME_STATUS_LABELS[status] ? ` · ${VOLUME_STATUS_LABELS[status]}` : ""}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-zinc-900">
                    <div
                      className={`h-full rounded-full ${VOLUME_STATUS_BAR_COLOR[status]}`}
                      style={{ width: `${Math.max(8, (item.volume / maxMuscleGroupVolume) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {user && !isLoading && adherence && (
        <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Adherencia esta semana</p>
          <p className="text-xl font-black mt-1">
            {adherence.completed} / {adherence.planned} entrenamientos
          </p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full bg-[#CCFF00]"
              style={{ width: `${Math.min(100, Math.max(4, (adherence.completed / adherence.planned) * 100))}%` }}
            />
          </div>
        </section>
      )}

      {user && !isLoading && topExercise && (
        <section className="mb-6 rounded-3xl border border-[#CCFF00]/40 bg-[#CCFF00]/10 p-4">
          <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Mayor volumen</p>
          <h2 className="text-xl font-black mt-1">{topExercise.name}</h2>
          <p className="text-sm text-zinc-400 mt-1">{Math.round(topExercise.volume)} kg acumulados</p>
        </section>
      )}

      {user && !isLoading && progress.length === 0 && (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Aún no hay progreso</h2>
          <p className="text-sm text-zinc-400 mt-2">Registra series desde una rutina para comenzar a medir progreso por ejercicio.</p>
          <Link href="/entrenar" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">
            Ir a entrenar
          </Link>
        </section>
      )}

      <section className="grid gap-4">
        {progress.map((item) => (
          <Link key={item.id} href={`/progreso/${item.id}`} className="block">
            <article className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">{item.name}</h2>
                  <p className="text-xs text-zinc-500 mt-1">{item.targetMuscle} · {item.equipment} · último {formatDate(item.lastDate)}</p>
                  {fatiguedExerciseIds.has(item.id) && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-300">
                      <AlertTriangle className="h-3 w-3" /> Señales de fatiga
                    </p>
                  )}
                </div>
                <Dumbbell className="h-6 w-6 text-[#CCFF00] shrink-0" />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-2xl bg-zinc-900 p-3">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <TrendingUp className="h-4 w-4" />
                    <p className="text-[10px] uppercase font-bold">Volumen</p>
                  </div>
                  <p className="font-black mt-1">{Math.round(item.volume)} kg</p>
                </div>
                <div className="rounded-2xl bg-zinc-900 p-3">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">Series</p>
                  <p className="font-black mt-1">{item.sets}</p>
                </div>
                <div className="rounded-2xl bg-zinc-900 p-3">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">Peso máx.</p>
                  <p className="font-black mt-1">{item.maxWeight} kg</p>
                </div>
                <div className="rounded-2xl bg-zinc-900 p-3">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">1RM est.</p>
                  <p className="font-black mt-1">
                    {item.estimatedOneRepMax !== null ? `${Math.round(item.estimatedOneRepMax)} kg` : "No disponible"}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-xs font-bold text-[#CCFF00]">Ver detalle</p>
            </article>
          </Link>
        ))}
      </section>
    </main>
  );
}
