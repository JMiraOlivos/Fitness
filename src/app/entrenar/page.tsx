"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Dumbbell, Loader2, Play } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/SessionProvider";

type RoutineListItem = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  routine_exercises?: Array<{ id: string }>;
};

export default function EntrenarIndexPage() {
  const { user, isLoading: isSessionLoading } = useSession();
  const [routines, setRoutines] = useState<RoutineListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSessionLoading) return;

    if (!user) {
      setIsLoading(false);
      return;
    }

    async function load() {
      setIsLoading(true);
      setError(null);

      const { data, error: loadError } = await supabase
        .from("routines")
        .select(`
          id,
          title,
          description,
          created_at,
          routine_exercises ( id )
        `)
        .order("created_at", { ascending: false });

      if (loadError) {
        setError(loadError.message);
      } else {
        setRoutines((data || []) as unknown as RoutineListItem[]);
      }

      setIsLoading(false);
    }

    void load();
  }, [user, isSessionLoading]);

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-16 font-sans max-w-md mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <header className="mb-8">
        <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Entrenar</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">Elige una rutina</h1>
        <p className="text-sm text-zinc-400 mt-2">Inicia un entrenamiento desde tus rutinas guardadas y registra cada serie.</p>
      </header>

      {isLoading && (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#CCFF00] mx-auto" />
          <p className="text-sm text-zinc-400 mt-3">Cargando rutinas...</p>
        </div>
      )}

      {!isLoading && !user && (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Inicia sesión primero</h2>
          <p className="text-sm text-zinc-400 mt-2">Vuelve al dashboard, inicia sesión y guarda una rutina antes de entrenar.</p>
          <Link href="/" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">
            Ir al dashboard
          </Link>
        </section>
      )}

      {error && (
        <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {!isLoading && user && routines.length === 0 && (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Sin rutinas guardadas</h2>
          <p className="text-sm text-zinc-400 mt-2">Genera una rutina con Gemini y presiona Guardar para poder iniciar un entrenamiento.</p>
          <Link href="/" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">
            Crear rutina
          </Link>
        </section>
      )}

      <section className="grid gap-4">
        {routines.map((routine) => (
          <article key={routine.id} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black">{routine.title}</h2>
                <p className="text-sm text-zinc-400 mt-1">{routine.description || "Rutina guardada"}</p>
                <p className="text-xs text-zinc-500 mt-2">{routine.routine_exercises?.length || 0} ejercicios</p>
              </div>
              <Dumbbell className="h-6 w-6 text-[#CCFF00] shrink-0" />
            </div>

            <Link
              href={`/entrenar/${routine.id}`}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black"
            >
              <Play className="h-5 w-5" /> Iniciar entrenamiento
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
