"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Save, Snowflake, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/SessionProvider";
import { authFetch } from "@/lib/authFetch";

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

    if (!routinesResult.error) setRoutines((routinesResult.data || []) as RoutineDay[]);

    setIsLoading(false);
  }, [programId]);

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
  const nextWeekIsDeload =
    program?.deload_every_n_weeks != null && !programComplete && nextWeek % program.deload_every_n_weeks === 0;

  async function generarSemana() {
    if (!program) return;

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
            esSemanaDescarga: nextWeekIsDeload,
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
        rutina: { ...rutina, programaId: programId, numeroSemana: nextWeek, diaSemana: index + 1 },
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
              {nextWeekIsDeload && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-blue-300">
                  <Snowflake className="h-3 w-3" /> Semana de descarga
                </p>
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
