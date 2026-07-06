"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Dumbbell, Loader2, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { one } from "@/lib/supabaseJoins";
import { estimateOneRepMax } from "@/lib/oneRepMax";
import { useSession } from "@/components/SessionProvider";

type ExerciseRef = {
  id: string;
  name: string;
  target_muscle: string;
  equipment: string;
};

type WorkoutRef = {
  start_time: string;
};

type SetLog = {
  id: string;
  weight: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  exercises?: ExerciseRef | ExerciseRef[] | null;
  workout_logs?: WorkoutRef | WorkoutRef[] | null;
};

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

function formatDate(value: string) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

export default function ProgresoPage() {
  const { user, isLoading: isSessionLoading } = useSession();
  const [setLogs, setSetLogs] = useState<SetLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const progress = useMemo(() => buildProgress(setLogs), [setLogs]);
  const totalVolume = useMemo(() => progress.reduce((sum, item) => sum + item.volume, 0), [progress]);
  const totalSets = useMemo(() => progress.reduce((sum, item) => sum + item.sets, 0), [progress]);
  const topExercise = progress[0];

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

      const { data, error: loadError } = await supabase
        .from("set_logs")
        .select(`
          id,
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
        <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Progreso</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">Por ejercicio</h1>
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
