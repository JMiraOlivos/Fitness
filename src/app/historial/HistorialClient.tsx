"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Dumbbell, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { one } from "@/lib/supabaseJoins";

const PAGE_SIZE = 20;

type RoutineRef = { title: string };
type SetLogRef = { weight: number; reps: number; is_warmup: boolean };
type WorkoutLog = {
  id: string;
  start_time: string;
  end_time: string | null;
  ai_insight: string | null;
  routines?: RoutineRef | RoutineRef[] | null;
  set_logs?: SetLogRef[];
};

function getWorkingSets(workout: WorkoutLog) {
  return (workout.set_logs || []).filter((sl) => !sl.is_warmup);
}

function getWorkoutVolume(workout: WorkoutLog) {
  return getWorkingSets(workout).reduce((sum, sl) => sum + Number(sl.weight || 0) * Number(sl.reps || 0), 0);
}

function getWorkoutDuration(startTime: string, endTime: string | null) {
  if (!endTime) return "En curso";
  const minutes = Math.max(1, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

type HistorialClientProps = {
  initialWorkouts: WorkoutLog[];
  hasMoreInitial: boolean;
  hasUser: boolean;
};

export function HistorialClient({ initialWorkouts, hasMoreInitial, hasUser }: HistorialClientProps) {
  const [workouts, setWorkouts] = useState<WorkoutLog[]>(initialWorkouts);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(hasMoreInitial);
  const [error, setError] = useState<string | null>(null);

  const totalVolume = useMemo(() => workouts.reduce((s, w) => s + getWorkoutVolume(w), 0), [workouts]);
  const totalSets = useMemo(() => workouts.reduce((s, w) => s + getWorkingSets(w).length, 0), [workouts]);

  async function cargarMas() {
    setIsLoadingMore(true);
    const { data, error: loadError } = await supabase
      .from("workout_logs")
      .select("id, start_time, end_time, ai_insight, routines ( title ), set_logs ( weight, reps, is_warmup )")
      .order("start_time", { ascending: false })
      .range(workouts.length, workouts.length + PAGE_SIZE - 1);

    if (loadError) {
      setError(loadError.message);
    } else {
      const page = (data || []) as unknown as WorkoutLog[];
      setWorkouts((c) => [...c, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    }
    setIsLoadingMore(false);
  }

  if (!hasUser) {
    return (
      <main className="min-h-screen bg-black text-white p-6 pb-16 font-sans max-w-md mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Inicia sesión primero</h2>
          <p className="text-sm text-zinc-400 mt-2">Crea usuario o inicia sesión para ver tu historial.</p>
          <Link href="/auth" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">
            Ir a login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-16 font-sans max-w-md mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <header className="mb-8">
        <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Historial</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">Tus entrenamientos</h1>
        <p className="text-sm text-zinc-400 mt-2">Revisa sesiones completadas, volumen, duración y series registradas.</p>
      </header>

      {error && (
        <div className="mb-6 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>
      )}

      {workouts.length > 0 && (
        <section className="grid grid-cols-3 gap-3 mb-8">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
            <p className="text-[10px] text-zinc-500 uppercase font-bold">Workouts</p>
            <p className="text-xl font-black mt-1">{workouts.length}</p>
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

      {workouts.length === 0 && (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Sin entrenamientos todavía</h2>
          <p className="text-sm text-zinc-400 mt-2">Inicia una rutina desde la sección Entrenar y registra tus primeras series.</p>
          <Link href="/entrenar" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">
            Ir a entrenar
          </Link>
        </section>
      )}

      <section className="grid gap-4">
        {workouts.map((workout) => {
          const routine = one(workout.routines);
          const volume = getWorkoutVolume(workout);
          const setCount = getWorkingSets(workout).length;
          const startDate = new Date(workout.start_time);

          return (
            <article key={workout.id} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-[#CCFF00] font-bold uppercase">
                    {startDate.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                  <h2 className="text-xl font-black mt-1">{routine?.title || "Entrenamiento"}</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    {startDate.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })} · {getWorkoutDuration(workout.start_time, workout.end_time)}
                  </p>
                </div>
                <Dumbbell className="h-6 w-6 text-[#CCFF00] shrink-0" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="rounded-2xl bg-zinc-900 p-3">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <TrendingUp className="h-4 w-4" />
                    <p className="text-[10px] uppercase font-bold">Volumen</p>
                  </div>
                  <p className="font-black mt-1">{Math.round(volume)} kg</p>
                </div>
                <div className="rounded-2xl bg-zinc-900 p-3">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <CalendarDays className="h-4 w-4" />
                    <p className="text-[10px] uppercase font-bold">Series</p>
                  </div>
                  <p className="font-black mt-1">{setCount}</p>
                </div>
              </div>
              {workout.ai_insight && (
                <p className="mt-4 rounded-2xl border border-zinc-800 bg-black p-3 text-xs text-zinc-400">{workout.ai_insight}</p>
              )}
              <Link href={`/historial/${workout.id}`} className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">
                Ver detalle
              </Link>
            </article>
          );
        })}
      </section>

      {hasMore && workouts.length > 0 && (
        <button onClick={cargarMas} disabled={isLoadingMore} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-black text-zinc-300 disabled:opacity-50">
          {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isLoadingMore ? "Cargando..." : "Cargar más"}
        </button>
      )}
    </main>
  );
}
