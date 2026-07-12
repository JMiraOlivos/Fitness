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
  estimatedOneRepMax: number | null;
};

type PrRecord = {
  id: string;
  metric_type: string;
  value: number;
  created_at: string;
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
      estimatedOneRepMax: null,
    };

    const weight = Number(log.weight || 0);
    const reps = Number(log.reps || 0);
    current.volume += weight * reps;
    current.maxWeight = Math.max(current.maxWeight, weight);
    current.sets += 1;
    const oneRepMax = estimateOneRepMax(weight, reps);
    if (oneRepMax !== null) {
      current.estimatedOneRepMax = Math.max(current.estimatedOneRepMax ?? 0, oneRepMax);
    }
    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key)).slice(-8);
}

// Minimal inline line chart of estimated 1RM over the recent sessions. Only sessions
// with a valid e1RM (reps within the estimable range) are plotted.
function OneRepMaxChart({ points }: { points: TrendPoint[] }) {
  const series = points.filter((point) => point.estimatedOneRepMax !== null);
  if (series.length < 2) return null;

  const width = 300;
  const height = 90;
  const padX = 6;
  const padY = 12;
  const values = series.map((point) => point.estimatedOneRepMax as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = series.map((point, index) => {
    const x = padX + (index / (series.length - 1)) * (width - padX * 2);
    const y = padY + (1 - ((point.estimatedOneRepMax as number) - min) / range) * (height - padY * 2);
    return { x, y, value: point.estimatedOneRepMax as number, label: point.label };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;

  return (
    <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Evolución de 1RM estimado</p>
        <span className={`text-xs font-bold ${delta > 0 ? "text-[#CCFF00]" : delta < 0 ? "text-red-400" : "text-zinc-500"}`}>
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {Math.abs(Math.round(delta))} kg
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 w-full" role="img" aria-label={`Evolución del 1RM estimado: de ${Math.round(first)} a ${Math.round(last)} kilos`}>
        <path d={linePath} fill="none" stroke="#CCFF00" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {coords.map((c) => (
          <circle key={c.label} cx={c.x} cy={c.y} r={2.5} fill="#CCFF00" />
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500">
        <span>{coords[0].label} · {Math.round(first)} kg</span>
        <span>{coords[coords.length - 1].label} · {Math.round(last)} kg</span>
      </div>
    </section>
  );
}

export default function ExerciseProgressDetailPage() {
  const params = useParams<{ exerciseId: string }>();
  const { user, isLoading: isSessionLoading } = useSession();
  const [logs, setLogs] = useState<SetLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prRecords, setPrRecords] = useState<PrRecord[]>([]);

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

      const { data: prs } = await supabase
        .from("personal_records")
        .select("id, metric_type, value, created_at")
        .eq("exercise_id", params.exerciseId)
        .order("created_at", { ascending: false })
        .limit(20);
      setPrRecords((prs || []) as unknown as PrRecord[]);

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

          <OneRepMaxChart points={trend} />

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

          {prRecords.length > 0 && (
            <section className="mb-6 rounded-3xl border border-amber-500/40 bg-amber-950/20 p-4">
              <p className="text-xs text-amber-300 uppercase font-bold tracking-wider">Récords personales</p>
              <div className="mt-3 grid gap-2">
                {prRecords.map((pr) => (
                  <div key={pr.id} className="flex items-center justify-between rounded-xl bg-zinc-900/70 px-3 py-2 text-xs">
                    <span className="text-zinc-400">
                      {pr.metric_type === "weight" ? "Peso máximo" :
                       pr.metric_type === "reps" ? "Repeticiones" :
                       pr.metric_type === "volume" ? "Volumen" :
                       pr.metric_type === "one_rep_max" ? "1RM estimado" :
                       pr.metric_type}
                    </span>
                    <span className="font-bold text-amber-200">
                      {pr.metric_type === "reps" ? pr.value : `${Math.round(pr.value)} kg`}
                      <span className="text-zinc-500 ml-1">· {new Date(pr.created_at).toLocaleDateString("es-CL", { day: "2-digit", month: "short" })}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

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
