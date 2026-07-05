"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type RoutineRef = { title: string; description: string | null };
type ExerciseRef = { name: string; target_muscle: string; equipment: string };
type SetLog = {
  id: string;
  set_number: number;
  weight: number;
  reps: number;
  rpe: number | null;
  exercises?: ExerciseRef | ExerciseRef[] | null;
};
type Workout = {
  id: string;
  start_time: string;
  end_time: string | null;
  ai_insight: string | null;
  routines?: RoutineRef | RoutineRef[] | null;
  set_logs?: SetLog[];
};

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function volume(logs: Array<{ weight: number; reps: number }>) {
  return logs.reduce((sum, log) => sum + Number(log.weight || 0) * Number(log.reps || 0), 0);
}

function duration(startTime: string, endTime: string | null) {
  if (!endTime) return "En curso";
  const minutes = Math.max(1, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function WorkoutDetailPage() {
  const params = useParams<{ workoutId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setLogs = useMemo(() => [...(workout?.set_logs || [])].sort((a, b) => a.set_number - b.set_number), [workout]);
  const routine = one(workout?.routines);
  const totalVolume = volume(setLogs);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      setUser(authData.user);

      if (!authData.user) {
        setIsLoading(false);
        return;
      }

      const { data, error: loadError } = await supabase
        .from("workout_logs")
        .select(`
          id,
          start_time,
          end_time,
          ai_insight,
          routines ( title, description ),
          set_logs (
            id,
            set_number,
            weight,
            reps,
            rpe,
            exercises ( name, target_muscle, equipment )
          )
        `)
        .eq("id", params.workoutId)
        .single();

      if (loadError) setError(loadError.message);
      else setWorkout(data as unknown as Workout);

      setIsLoading(false);
    }

    void load();
  }, [params.workoutId]);

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

  if (!workout) {
    return (
      <main className="min-h-screen bg-black text-white p-6 max-w-md mx-auto">
        <Link href="/historial" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-8">
          <ArrowLeft className="h-4 w-4" /> Historial
        </Link>
        <p className="text-red-300">{error || "No se encontró este entrenamiento."}</p>
      </main>
    );
  }

  const date = new Date(workout.start_time);

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-16 font-sans max-w-md mx-auto">
      <Link href="/historial" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <ArrowLeft className="h-4 w-4" /> Historial
      </Link>

      <header className="mb-6">
        <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Detalle</p>
        <h1 className="text-3xl font-black mt-1">{routine?.title || "Entrenamiento"}</h1>
        <p className="text-sm text-zinc-400 mt-2">
          {date.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" })} · {duration(workout.start_time, workout.end_time)}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs text-zinc-500 uppercase font-bold">Volumen</p>
          <p className="text-xl font-black mt-1">{Math.round(totalVolume)} kg</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs text-zinc-500 uppercase font-bold">Series</p>
          <p className="text-xl font-black mt-1">{setLogs.length}</p>
        </div>
      </section>

      {workout.ai_insight && <p className="mb-6 rounded-2xl bg-zinc-950 border border-zinc-800 p-4 text-sm text-zinc-300">{workout.ai_insight}</p>}

      <section className="grid gap-3">
        {setLogs.map((setLog) => {
          const exercise = one(setLog.exercises);
          return (
            <article key={setLog.id} className="rounded-2xl bg-zinc-950 border border-zinc-800 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-black">{exercise?.name || "Ejercicio"}</h2>
                  <p className="text-xs text-zinc-500">Serie {setLog.set_number} · {exercise?.target_muscle || "Músculo"}</p>
                </div>
                <p className="text-sm font-bold text-[#CCFF00]">{setLog.weight} kg / {setLog.reps} reps</p>
              </div>
              {setLog.rpe && <p className="text-xs text-zinc-500 mt-2">RPE {setLog.rpe}</p>}
            </article>
          );
        })}
      </section>
    </main>
  );
}
