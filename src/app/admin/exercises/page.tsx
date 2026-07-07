"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Save, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/SessionProvider";
import { EXERCISE_DIFFICULTIES, EXERCISE_DIFFICULTY_LABELS, MUSCLE_GROUPS } from "@/lib/exerciseTaxonomy";
import { MOVEMENT_PATTERNS } from "@/lib/training/prescriptionTaxonomy";

type ExerciseRow = {
  id: string;
  name: string;
  target_muscle: string;
  equipment: string;
  canonical_name: string | null;
  aliases: string[];
  movement_pattern: string | null;
  difficulty: string | null;
  is_verified: boolean;
};

function aliasesToText(aliases: string[]) {
  return aliases.join(", ");
}

function textToAliases(text: string) {
  return text
    .split(",")
    .map((alias) => alias.trim())
    .filter(Boolean);
}

export default function AdminExercisesPage() {
  const { user, isLoading: isSessionLoading } = useSession();
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [muscleFilter, setMuscleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isSessionLoading) return;

    if (!user) {
      setIsCheckingAdmin(false);
      return;
    }

    async function checkAdmin() {
      const { data } = await supabase.from("profiles").select("is_admin").eq("id", user!.id).maybeSingle();
      setIsAdmin(Boolean(data?.is_admin));
      setIsCheckingAdmin(false);
    }

    void checkAdmin();
  }, [user, isSessionLoading]);

  useEffect(() => {
    if (!isAdmin) return;

    async function loadExercises() {
      setIsLoading(true);
      setError(null);

      const { data, error: loadError } = await supabase
        .from("exercises")
        .select("id, name, target_muscle, equipment, canonical_name, aliases, movement_pattern, difficulty, is_verified")
        .is("owner_id", null)
        .order("target_muscle", { ascending: true })
        .order("name", { ascending: true })
        .limit(300);

      if (loadError) setError(loadError.message);
      else setExercises((data || []) as ExerciseRow[]);

      setIsLoading(false);
    }

    void loadExercises();
  }, [isAdmin]);

  const filteredExercises = useMemo(() => {
    return exercises.filter((exercise) => {
      if (muscleFilter && exercise.target_muscle !== muscleFilter) return false;
      if (search && !exercise.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [exercises, muscleFilter, search]);

  function updateLocalExercise(id: string, patch: Partial<ExerciseRow>) {
    setExercises((current) => current.map((exercise) => (exercise.id === id ? { ...exercise, ...patch } : exercise)));
  }

  async function guardarEjercicio(exercise: ExerciseRow) {
    setSavingId(exercise.id);
    setError(null);
    setSuccessMessage(null);

    const { error: updateError } = await supabase
      .from("exercises")
      .update({
        canonical_name: exercise.canonical_name || null,
        aliases: exercise.aliases,
        movement_pattern: exercise.movement_pattern || null,
        difficulty: exercise.difficulty || null,
        is_verified: exercise.is_verified,
      })
      .eq("id", exercise.id);

    setSavingId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccessMessage(`"${exercise.name}" actualizado.`);
  }

  if (isSessionLoading || isCheckingAdmin) {
    return (
      <main className="min-h-screen bg-black text-white p-6 max-w-2xl mx-auto flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#CCFF00]" />
      </main>
    );
  }

  if (!user || !isAdmin) {
    return (
      <main className="min-h-screen bg-black text-white p-6 max-w-md mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-8">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <section className="rounded-3xl border border-red-900/60 bg-red-950/30 p-5">
          <h1 className="inline-flex items-center gap-2 text-xl font-black">
            <ShieldAlert className="h-5 w-5 text-red-400" /> No autorizado
          </h1>
          <p className="mt-2 text-sm text-red-200">Esta pantalla es solo para administradores del catálogo de ejercicios.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-16 font-sans max-w-2xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <header className="mb-6">
        <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Admin</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">Catálogo de ejercicios</h1>
        <p className="text-sm text-zinc-400 mt-2">
          Cura aliases, patrón de movimiento, dificultad y verifica ejercicios globales para mejorar el matching automático.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre"
          className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-[#CCFF00]"
        />
        <select
          value={muscleFilter}
          onChange={(event) => setMuscleFilter(event.target.value)}
          className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-[#CCFF00]"
        >
          <option value="">Todos los grupos</option>
          {MUSCLE_GROUPS.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="mb-4 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>}
      {successMessage && (
        <div className="mb-4 rounded-2xl border border-lime-900/60 bg-lime-950/40 p-4 text-sm text-lime-200 inline-flex gap-2">
          <CheckCircle2 className="h-5 w-5 shrink-0" /> {successMessage}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#CCFF00] mx-auto" />
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredExercises.map((exercise) => (
            <article key={exercise.id} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">{exercise.name}</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    {exercise.target_muscle} · {exercise.equipment}
                  </p>
                </div>
                {exercise.is_verified && (
                  <span className="shrink-0 rounded-full bg-lime-900/40 px-3 py-1 text-[10px] font-bold uppercase text-lime-300">
                    Verificado
                  </span>
                )}
              </div>

              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-xs">
                  <span className="text-zinc-400">Nombre canónico</span>
                  <input
                    value={exercise.canonical_name || ""}
                    onChange={(event) => updateLocalExercise(exercise.id, { canonical_name: event.target.value })}
                    placeholder={exercise.name}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-[#CCFF00]"
                  />
                </label>

                <label className="grid gap-1 text-xs">
                  <span className="text-zinc-400">Aliases (separados por coma)</span>
                  <input
                    value={aliasesToText(exercise.aliases)}
                    onChange={(event) => updateLocalExercise(exercise.id, { aliases: textToAliases(event.target.value) })}
                    placeholder="Press banca, Barbell bench press"
                    className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-[#CCFF00]"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-xs">
                    <span className="text-zinc-400">Patrón de movimiento</span>
                    <select
                      value={exercise.movement_pattern || ""}
                      onChange={(event) => updateLocalExercise(exercise.id, { movement_pattern: event.target.value || null })}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-[#CCFF00]"
                    >
                      <option value="">Sin definir</option>
                      {MOVEMENT_PATTERNS.map((pattern) => (
                        <option key={pattern} value={pattern}>
                          {pattern}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1 text-xs">
                    <span className="text-zinc-400">Dificultad</span>
                    <select
                      value={exercise.difficulty || ""}
                      onChange={(event) => updateLocalExercise(exercise.id, { difficulty: event.target.value || null })}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-[#CCFF00]"
                    >
                      <option value="">Sin definir</option>
                      {EXERCISE_DIFFICULTIES.map((difficulty) => (
                        <option key={difficulty} value={difficulty}>
                          {EXERCISE_DIFFICULTY_LABELS[difficulty]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="flex items-center gap-2 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    checked={exercise.is_verified}
                    onChange={(event) => updateLocalExercise(exercise.id, { is_verified: event.target.checked })}
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-[#CCFF00]"
                  />
                  Verificado
                </label>

                <button
                  type="button"
                  onClick={() => void guardarEjercicio(exercise)}
                  disabled={savingId === exercise.id}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#CCFF00] px-4 py-2 text-sm font-black text-black disabled:opacity-60"
                >
                  {savingId === exercise.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar
                </button>
              </div>
            </article>
          ))}

          {filteredExercises.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-8">No hay ejercicios que coincidan con el filtro.</p>
          )}
        </div>
      )}
    </main>
  );
}
