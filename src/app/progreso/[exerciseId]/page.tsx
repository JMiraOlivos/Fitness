"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { one } from "@/lib/supabaseJoins";
import { estimateOneRepMax } from "@/lib/oneRepMax";
import { useSession } from "@/components/SessionProvider";

const PAGE_SIZE = 50;

type ExerciseRef = { id: string; name: string; target_muscle: string; equipment: string };
type WorkoutRef = { start_time: string };
type SetLog = {
  id: string;
  set_number: number;
  weight: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  exercises?: ExerciseRef | ExerciseRef[] | null;
  workout_logs?: WorkoutRef | WorkoutRef[] | null;
};

type TrendPoint = {
  key: string;
  label: string;
  volume: number;
  maxWeight: number;
  sets: number;
};

function volume(logs: SetLog[]) {
  return logs.reduce((sum, log) => sum + Number(log.weight || 0) * Number(log.reps || 0), 0);
}

function dateLabel(value?: string) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function shortDateLabel(value: string) {
  return new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

function dateKey(value?: string) {
  if (!value) return "sin-fecha";
  return new Date(value).toLocaleDateString("en-CA");
}

function buildTrend(logs: SetLog[]) {
  const map = new Map<string, TrendPoint>();

  for (const log of logs) {
    const workout = one(log.workout_logs);
    const key = dateKey(workout?.start_time);
    const current = map.get(key) || {
      key,
      label: workout?.start_time ? shortDateLabel(workout.start_time) : "Sin fecha",
      volume: 0,
      maxWeight: 0,
      sets: 0,
    };

    const weight = Number(log.weight || 0);
    const reps = Number(log.reps || 0);
    current.volume += weight * reps;
    current.maxWeight = Math.max(current.maxWeight, weight);
    current.sets += 1;
    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key)).slice(-8);
}

export default function ExerciseProgressDetailPage() {
  const params = useParams<{ exerciseId: string }>();
  const { user, isLoading: isSessionLoading } = useSession();
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const exercise = one(logs[0]?.exercises);
  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      const aWorkout = one(a.workout_logs);
      const bWorkout = one(b.workout_logs);
      return new Date(bWorkout?.start_time || 0).getTime() - new Date(aWorkout?.start_time || 0).getTime();
    });
  }, [logs]);

  const workingLogs = useMemo(() => logs.filter((log) => !log.is_warmup), [logs]);
  const totalVolume = useMemo(() => volume(workingLogs), [workingLogs]);
  const maxWeight = useMemo(() => workingLogs.reduce((max, log) => Math.max(max, Number(log.weight || 0)), 0), [workingLogs]);
  const bestOneRepMax = useMemo(() => {
    return workingLogs.reduce((max: number | null, log) => {
      const oneRepMax = estimateOneRepMax(Number(log.weight || 0), Number(log.reps || 0));
      if (oneRepMax === null) return max;
      return max === null ? oneRepMax : Math.max(max, oneRepMax);
    }, null);
  }, [workingLogs]);
  const trend = useMemo(() => buildTrend(workingLogs), [workingLogs]);
  const maxTrendVolume = useMemo(() => Math.max(...trend.map((point) => point.volume), 1), [trend]);

  const loadPage = useCallback(
    async (from: number) => {
      const { data, error: loadError } = await supabase
        .from("set_logs")
        .select(`
          id,
          set_number,
          weight,
          reps,
          rpe,
          is_warmup,
          exercises ( id, name, target_muscle, equipment ),
          workout_logs ( start_time )
        `)
        .eq("exercise_id", params.exerciseId)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (loadError) {
        setError(loadError.message);
        return [];
      }

      const page = (data || []) as unknown as SetLog[];
      setHasMore(page.length === PAGE_SIZE);
      return page;
    },
    [params.exerciseId]
  );

  useEffect(() => {
    if (isSessionLoading) return;

    if (!user) {
      setIsLoading(false);
      return;
    }

    async function loadExercise() {
      setIsLoading(true);
      setError(null);

      const page = await loadPage(0);
      setLogs(page);
      setIsLoading(false);
    }

    void loadExercise();
  }, [user, isSessionLoading, loadPage]);

  async function cargarMas() {
    setIsLoadingMore(true);
    const nextPage = await loadPage(logs.length);
    setLogs((current) => [...current, ...nextPage]);
    setIsLoadingMore(false);
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-black text-white p-6 max-w-md mx-auto flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#CCFF00]" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-black text-white p-6 max-w-md mx-auto">
        <Link href="/auth" className="text-[#CCFF00] font-bold">Iniciar sesión</Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-16 font-sans max-w-md mx-auto">
      <Link href="/progreso" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <ArrowLeft className="h-4 w-4" /> Progreso
      </Link>

      <header className="mb-8">
        <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Detalle ejercicio</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">{exercise?.name || "Ejercicio"}</h1>
        <p className="text-sm text-zinc-400 mt-2">{exercise ? `${exercise.target_muscle} · ${exercise.equipment}` : "Series históricas"}</p>
      </header>

      {error && <div className="mb-6 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>}

      {logs.length === 0 && !error && (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Sin registros</h2>
          <p className="text-sm text-zinc-400 mt-2">Todavía no hay series registradas para este ejercicio.</p>
        </section>
      )}

      {logs.length > 0 && (
        <>
          <section className="grid grid-cols-3 gap-3 mb-8">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-[10px] text-zinc-500 uppercase font-bold">Series</p>
              <p className="text-xl font-black mt-1">{workingLogs.length}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-[10px] text-zinc-500 uppercase font-bold">Máx.</p>
              <p className="text-xl font-black mt-1">{maxWeight}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-[10px] text-zinc-500 uppercase font-bold">1RM</p>
              <p className="text-xl font-black mt-1">
                {bestOneRepMax !== null ? Math.round(bestOneRepMax) : "N/D"}
              </p>
            </div>
          </section>

          <section className="mb-6 rounded-3xl border border-[#CCFF00]/40 bg-[#CCFF00]/10 p-4">
            <div className="flex items-center gap-2 text-[#CCFF00]">
              <TrendingUp className="h-5 w-5" />
              <p className="text-xs uppercase font-bold tracking-wider">Volumen acumulado</p>
            </div>
            <p className="text-2xl font-black mt-2">{Math.round(totalVolume)} kg</p>
          </section>

          <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Tendencia de volumen</p>
            <div className="mt-4 grid gap-3">
              {trend.map((point) => (
                <div key={point.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-300">{point.label}</span>
                    <span className="text-zinc-500">{Math.round(point.volume)} kg · {point.sets} series</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-zinc-900">
                    <div className="h-full rounded-full bg-[#CCFF00]" style={{ width: `${Math.max(8, (point.volume / maxTrendVolume) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-3">
            {sortedLogs.map((log) => {
              const workout = one(log.workout_logs);
              return (
                <article key={log.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black">{log.weight} kg x {log.reps} reps</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {dateLabel(workout?.start_time)} · Serie {log.set_number}
                        {log.is_warmup && <span className="text-[#CCFF00]"> · Calentamiento</span>}
                      </p>
                    </div>
                    {log.rpe && <p className="text-sm font-bold text-[#CCFF00]">RPE {log.rpe}</p>}
                  </div>
                </article>
              );
            })}
          </section>

          {hasMore && (
            <button
              onClick={cargarMas}
              disabled={isLoadingMore}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-black text-zinc-300 disabled:opacity-50"
            >
              {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isLoadingMore ? "Cargando..." : "Cargar más"}
            </button>
          )}
        </>
      )}
    </main>
  );
}
