"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarRange, Loader2, Plus, Snowflake } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/SessionProvider";

type Program = {
  id: string;
  name: string;
  focus: string | null;
  duration_weeks: number;
  days_per_week: number;
  deload_every_n_weeks: number | null;
};

type RoutineWeek = {
  program_id: string | null;
  week_number: number | null;
};

function currentWeekFor(programId: string, routineWeeks: RoutineWeek[]) {
  const weeks = routineWeeks.filter((row) => row.program_id === programId).map((row) => row.week_number ?? 0);
  return weeks.length > 0 ? Math.max(...weeks) : 0;
}

function isNextWeekDeload(program: Program, nextWeek: number) {
  return program.deload_every_n_weeks !== null && nextWeek <= program.duration_weeks && nextWeek % program.deload_every_n_weeks === 0;
}

export default function ProgramasPage() {
  const { user, isLoading: isSessionLoading } = useSession();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [routineWeeks, setRoutineWeeks] = useState<RoutineWeek[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadPrograms() {
    setIsLoading(true);
    setError(null);

    const [programsResult, routinesResult] = await Promise.all([
      supabase
        .from("programs")
        .select("id, name, focus, duration_weeks, days_per_week, deload_every_n_weeks")
        .order("created_at", { ascending: false }),
      supabase.from("routines").select("program_id, week_number").not("program_id", "is", null),
    ]);

    if (programsResult.error) setError(programsResult.error.message);
    else setPrograms((programsResult.data || []) as Program[]);

    if (!routinesResult.error) setRoutineWeeks((routinesResult.data || []) as RoutineWeek[]);

    setIsLoading(false);
  }

  useEffect(() => {
    if (isSessionLoading) return;

    if (!user) {
      setIsLoading(false);
      return;
    }

    void loadPrograms();
  }, [user, isSessionLoading]);

  const programsWithProgress = useMemo(
    () =>
      programs.map((program) => {
        const currentWeek = currentWeekFor(program.id, routineWeeks);
        const nextWeek = Math.min(currentWeek + 1, program.duration_weeks);
        return { program, currentWeek, nextWeekIsDeload: isNextWeekDeload(program, nextWeek) };
      }),
    [programs, routineWeeks]
  );

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-28 font-sans max-w-md mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <ArrowLeft className="h-4 w-4" /> Inicio
      </Link>

      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Mesociclos</p>
          <h1 className="text-3xl font-black tracking-tight mt-1">Mis programas</h1>
        </div>
        <Link href="/programas/nuevo" className="rounded-full bg-[#CCFF00] p-3 text-black">
          <Plus className="h-5 w-5" />
        </Link>
      </header>

      {!user && !isSessionLoading && (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Inicia sesión primero</h2>
          <p className="text-sm text-zinc-400 mt-2">Crea usuario o inicia sesión para armar un mesociclo.</p>
          <Link href="/auth" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">
            Ir a login
          </Link>
        </section>
      )}

      {error && <div className="mb-6 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>}

      {user && isLoading && (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#CCFF00] mx-auto" />
        </div>
      )}

      {user && !isLoading && programs.length === 0 && (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Sin programas todavía</h2>
          <p className="text-sm text-zinc-400 mt-2">Crea un mesociclo para planificar varias semanas con progresión y deload.</p>
          <Link href="/programas/nuevo" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">
            Crear programa
          </Link>
        </section>
      )}

      {user && !isLoading && programs.length > 0 && (
        <section className="grid gap-3">
          {programsWithProgress.map(({ program, currentWeek, nextWeekIsDeload }) => (
            <Link
              key={program.id}
              href={`/programas/${program.id}`}
              className="block rounded-3xl border border-zinc-800 bg-zinc-950 p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black text-lg">{program.name}</p>
                  {program.focus && <p className="text-xs text-zinc-500 mt-1">{program.focus}</p>}
                </div>
                <CalendarRange className="h-5 w-5 text-[#CCFF00]" />
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
                <span className="rounded-full bg-zinc-900 px-3 py-1 font-bold">
                  Semana {currentWeek} de {program.duration_weeks}
                </span>
                {nextWeekIsDeload && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-950/60 px-3 py-1 font-bold text-blue-300">
                    <Snowflake className="h-3 w-3" /> Próxima semana: deload
                  </span>
                )}
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
