"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Save, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/SessionProvider";
import { authFetch } from "@/lib/authFetch";

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

export default function NuevoProgramaPage() {
  const { user } = useSession();
  const router = useRouter();

  const [name, setName] = useState("");
  const [focus, setFocus] = useState("Hipertrofia upper/lower");
  const [durationWeeks, setDurationWeeks] = useState("6");
  const [daysPerWeek, setDaysPerWeek] = useState("4");
  const [hasDeload, setHasDeload] = useState(true);
  const [deloadEveryNWeeks, setDeloadEveryNWeeks] = useState("6");

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const [rutinasSemana1, setRutinasSemana1] = useState<RutinaIA[]>([]);
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  async function crearPrograma() {
    if (!user) {
      setError("Inicia sesión para crear un programa.");
      return;
    }

    const duration = Number(durationWeeks);
    const days = Number(daysPerWeek);
    const deload = hasDeload ? Number(deloadEveryNWeeks) : null;

    if (!name.trim()) {
      setError("Ponle un nombre al programa.");
      return;
    }

    if (!Number.isInteger(duration) || duration < 1 || duration > 16) {
      setError("La duración debe ser entre 1 y 16 semanas.");
      return;
    }

    if (!Number.isInteger(days) || days < 1 || days > 7) {
      setError("Los días por semana deben ser entre 1 y 7.");
      return;
    }

    if (deload !== null && (!Number.isInteger(deload) || deload < 2 || deload > duration)) {
      setError("La cadencia de deload debe ser entre 2 y la duración total del programa.");
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      const { data, error: insertError } = await supabase
        .from("programs")
        .insert({
          user_id: user.id,
          name: name.trim(),
          focus: focus.trim() || null,
          duration_weeks: duration,
          days_per_week: days,
          deload_every_n_weeks: deload,
        })
        .select("id")
        .single();

      if (insertError) throw new Error(insertError.message);

      const newProgramId = data.id as string;
      setProgramId(newProgramId);

      const esSemanaDescarga = deload !== null && 1 % deload === 0;

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const response = await fetch("/api/ai/generar-rutina", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          diasDisponibles: days,
          enfoque: focus,
          programaContexto: { nombre: name.trim(), semanaActual: 1, semanasTotales: duration, esSemanaDescarga },
        }),
      });

      const generado = (await response.json()) as { rutinas?: RutinaIA[]; error?: string };
      if (!response.ok) throw new Error(generado.error || "No se pudo generar la semana 1.");

      setRutinasSemana1(generado.rutinas || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setIsCreating(false);
    }
  }

  async function guardarDia(rutina: RutinaIA, index: number) {
    if (!programId) return;

    setError(null);
    setSavingIndex(index);

    try {
      await authFetch("/api/routines/save", {
        rutina: { ...rutina, programaId: programId, numeroSemana: 1, diaSemana: index + 1 },
      });

      setSavedIndexes((current) => new Set(current).add(index));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el día.");
    } finally {
      setSavingIndex(null);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-28 font-sans max-w-md mx-auto">
      <Link href="/programas" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <ArrowLeft className="h-4 w-4" /> Programas
      </Link>

      <header className="mb-8">
        <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Mesociclos</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">Nuevo programa</h1>
        <p className="text-sm text-zinc-400 mt-2">Define el bloque y genera la primera semana con IA.</p>
      </header>

      {error && <div className="mb-6 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>}

      {!programId && (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 grid gap-3">
          <label className="grid gap-1 text-xs text-zinc-400">
            Nombre del programa
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej: Fuerza 6 semanas"
              className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
            />
          </label>

          <label className="grid gap-1 text-xs text-zinc-400">
            Enfoque
            <input
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs text-zinc-400">
              Duración (semanas)
              <input
                value={durationWeeks}
                onChange={(event) => {
                  setDurationWeeks(event.target.value);
                  setDeloadEveryNWeeks(event.target.value);
                }}
                inputMode="numeric"
                className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
              />
            </label>
            <label className="grid gap-1 text-xs text-zinc-400">
              Días por semana
              <input
                value={daysPerWeek}
                onChange={(event) => setDaysPerWeek(event.target.value)}
                inputMode="numeric"
                className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
            <input type="checkbox" checked={hasDeload} onChange={(event) => setHasDeload(event.target.checked)} />
            Incluir semana(s) de descarga
          </label>

          {hasDeload && (
            <label className="grid gap-1 text-xs text-zinc-400">
              Cada cuántas semanas hay deload
              <input
                value={deloadEveryNWeeks}
                onChange={(event) => setDeloadEveryNWeeks(event.target.value)}
                inputMode="numeric"
                className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
              />
            </label>
          )}

          <button
            onClick={crearPrograma}
            disabled={isCreating}
            className="mt-2 w-full rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isCreating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            Crear y generar semana 1
          </button>
        </section>
      )}

      {programId && rutinasSemana1.length > 0 && (
        <section className="grid gap-3">
          <p className="text-sm text-zinc-400">Semana 1 generada. Guarda cada día para agregarlo al programa.</p>

          {rutinasSemana1.map((rutina, index) => (
            <div key={index} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="font-black">{rutina.titulo}</p>
              <p className="text-xs text-zinc-500 mt-1">{rutina.descripcion}</p>
              <ul className="mt-3 grid gap-1 text-xs text-zinc-400">
                {rutina.ejercicios.map((ejercicio, exerciseIndex) => (
                  <li key={exerciseIndex}>
                    {ejercicio.nombre} — {ejercicio.seriesObjetivo}x{ejercicio.repeticionesObjetivo}
                  </li>
                ))}
              </ul>

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

          <button
            onClick={() => router.push(`/programas/${programId}`)}
            className="mt-2 w-full rounded-2xl border border-zinc-800 px-4 py-3 font-black text-white"
          >
            Ver programa
          </button>
        </section>
      )}
    </main>
  );
}
