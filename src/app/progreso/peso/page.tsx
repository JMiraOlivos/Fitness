"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/SessionProvider";

type BodyMeasurement = {
  id: string;
  recorded_at: string;
  weight_kg: number;
  body_fat_percentage: number | null;
  notes: string | null;
};

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function todayInputValue() {
  return new Date().toLocaleDateString("en-CA");
}

export default function PesoPage() {
  const { user, isLoading: isSessionLoading } = useSession();
  const [entries, setEntries] = useState<BodyMeasurement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recordedAt, setRecordedAt] = useState(todayInputValue());
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPercentage, setBodyFatPercentage] = useState("");
  const [notes, setNotes] = useState("");

  // entries are loaded sorted newest-first; oldest-first is easier to diff over time.
  const sortedAscending = useMemo(() => [...entries].reverse(), [entries]);
  const latest = entries[0];
  const previous = entries[1];
  const first = sortedAscending[0];

  const changeSincePrevious = latest && previous ? latest.weight_kg - previous.weight_kg : null;
  const changeSinceFirst = latest && first && latest.id !== first.id ? latest.weight_kg - first.weight_kg : null;

  async function loadEntries(userId: string) {
    setIsLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from("body_measurements")
      .select("id, recorded_at, weight_kg, body_fat_percentage, notes")
      .order("recorded_at", { ascending: false })
      .limit(90);

    if (loadError) {
      setError(loadError.message);
    } else {
      setEntries((data || []) as BodyMeasurement[]);
    }

    setIsLoading(false);
    void userId;
  }

  useEffect(() => {
    if (isSessionLoading) return;

    if (!user) {
      setIsLoading(false);
      return;
    }

    void loadEntries(user.id);
  }, [user, isSessionLoading]);

  async function registrarPeso() {
    if (!user) return;

    const weight = Number(weightKg);
    const bodyFat = bodyFatPercentage ? Number(bodyFatPercentage) : null;

    setError(null);

    if (!Number.isFinite(weight) || weight <= 0) {
      setError("Ingresa un peso válido.");
      return;
    }

    if (bodyFat !== null && (!Number.isFinite(bodyFat) || bodyFat < 0 || bodyFat > 100)) {
      setError("El % de grasa corporal debe estar entre 0 y 100.");
      return;
    }

    setIsSaving(true);

    const { error: insertError } = await supabase.from("body_measurements").insert({
      user_id: user.id,
      recorded_at: recordedAt,
      weight_kg: weight,
      body_fat_percentage: bodyFat,
      notes: notes.trim() || null,
    });

    setIsSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setWeightKg("");
    setBodyFatPercentage("");
    setNotes("");
    await loadEntries(user.id);
  }

  async function borrarEntrada(id: string) {
    if (!user) return;

    const { error: deleteError } = await supabase.from("body_measurements").delete().eq("id", id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    await loadEntries(user.id);
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-16 font-sans max-w-md mx-auto">
      <Link href="/progreso" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <ArrowLeft className="h-4 w-4" /> Progreso
      </Link>

      <header className="mb-8">
        <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Progreso</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">Peso corporal</h1>
        <p className="text-sm text-zinc-400 mt-2">Registra tu peso y % de grasa corporal para ver la tendencia en el tiempo.</p>
      </header>

      {!user && !isSessionLoading && (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Inicia sesión primero</h2>
          <p className="text-sm text-zinc-400 mt-2">Crea usuario o inicia sesión para registrar tu peso.</p>
          <Link href="/auth" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">
            Ir a login
          </Link>
        </section>
      )}

      {user && (
        <>
          <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="grid grid-cols-3 gap-2">
              <label className="grid gap-1 text-xs text-zinc-400">
                Fecha
                <input
                  type="date"
                  value={recordedAt}
                  onChange={(event) => setRecordedAt(event.target.value)}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
                />
              </label>
              <label className="grid gap-1 text-xs text-zinc-400">
                Peso (kg)
                <input
                  value={weightKg}
                  onChange={(event) => setWeightKg(event.target.value)}
                  inputMode="decimal"
                  placeholder="78.5"
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
                />
              </label>
              <label className="grid gap-1 text-xs text-zinc-400">
                % grasa
                <input
                  value={bodyFatPercentage}
                  onChange={(event) => setBodyFatPercentage(event.target.value)}
                  inputMode="decimal"
                  placeholder="Opcional"
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
                />
              </label>
            </div>

            <label className="grid gap-1 text-xs text-zinc-400 mt-3">
              Notas
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Opcional"
                className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
              />
            </label>

            <button
              onClick={registrarPeso}
              disabled={isSaving}
              className="mt-3 w-full rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
              Registrar
            </button>
          </section>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>
          )}

          {isLoading && (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#CCFF00] mx-auto" />
            </div>
          )}

          {!isLoading && latest && (
            <section className="mb-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-[#CCFF00]/40 bg-[#CCFF00]/10 p-3">
                <p className="text-[10px] text-zinc-400 uppercase font-bold">Último registro</p>
                <p className="text-xl font-black mt-1">{latest.weight_kg} kg</p>
                <p className="text-xs text-zinc-500 mt-1">{formatDate(latest.recorded_at)}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Desde el primer registro</p>
                <p className="text-xl font-black mt-1 inline-flex items-center gap-1">
                  {changeSinceFirst !== null ? (
                    <>
                      {changeSinceFirst > 0 ? (
                        <TrendingUp className="h-4 w-4 text-red-400" />
                      ) : changeSinceFirst < 0 ? (
                        <TrendingDown className="h-4 w-4 text-[#CCFF00]" />
                      ) : null}
                      {changeSinceFirst > 0 ? "+" : ""}
                      {changeSinceFirst.toFixed(1)} kg
                    </>
                  ) : (
                    "N/D"
                  )}
                </p>
                {changeSincePrevious !== null && (
                  <p className="text-xs text-zinc-500 mt-1">
                    {changeSincePrevious > 0 ? "+" : ""}
                    {changeSincePrevious.toFixed(1)} kg vs. anterior
                  </p>
                )}
              </div>
            </section>
          )}

          {!isLoading && entries.length === 0 && (
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <h2 className="text-xl font-black">Sin registros todavía</h2>
              <p className="text-sm text-zinc-400 mt-2">Registra tu peso arriba para empezar a ver tu tendencia.</p>
            </section>
          )}

          {!isLoading && entries.length > 0 && (
            <section className="grid gap-3">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <div>
                    <p className="font-black">
                      {entry.weight_kg} kg
                      {entry.body_fat_percentage !== null && (
                        <span className="text-zinc-400 font-bold"> · {entry.body_fat_percentage}% grasa</span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {formatDate(entry.recorded_at)}
                      {entry.notes ? ` · ${entry.notes}` : ""}
                    </p>
                  </div>
                  <button onClick={() => borrarEntrada(entry.id)} className="rounded-full bg-zinc-900 p-2 text-zinc-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
