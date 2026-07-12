"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Bike, Footprints, HeartPulse, Loader2, Plus, Timer, Trash2, Waves } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/SessionProvider";
import { classifyHeartRateZone, estimateMaxHeartRate } from "@/lib/training/hrZones";
import { fetchActiveProgram } from "@/features/dashboard/data/dashboardQueries";
import type { ActiveProgram } from "@/features/dashboard/types";

const CARDIO_TYPES: Record<string, { label: string; icon: typeof Bike }> = {
  running: { label: "Correr", icon: Footprints },
  cycling: { label: "Bicicleta", icon: Bike },
  walking: { label: "Caminar", icon: Footprints },
  swimming: { label: "Natación", icon: Waves },
  rowing: { label: "Remo", icon: Timer },
  other: { label: "Otro", icon: Timer },
};

type CardioLog = {
  id: string;
  type: string;
  duration_seconds: number;
  distance_meters: number | null;
  heart_rate_avg: number | null;
  heart_rate_max: number | null;
  perceived_effort: number | null;
  program_id: string | null;
  calories: number | null;
  notes: string | null;
  created_at: string;
};

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}min ${s}s` : `${m}min`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

export default function CardioPage() {
  const { user, isLoading: isSessionLoading } = useSession();
  const [logs, setLogs] = useState<CardioLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ type: string; minutes: string; seconds: string; distance: string; heartRate: string; heartRateMax: string; perceivedEffort: string; calories: string; notes: string; linkProgram: boolean }>({ type: "running", minutes: "30", seconds: "0", distance: "", heartRate: "", heartRateMax: "", perceivedEffort: "", calories: "", notes: "", linkProgram: true });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [maxHr, setMaxHr] = useState<number | null>(null);
  const [activeProgram, setActiveProgram] = useState<ActiveProgram | null>(null);

  useEffect(() => {
    if (isSessionLoading) return;
    if (!user) { setIsLoading(false); return; }
    void cargar();
  }, [user, isSessionLoading]);

  const emptyForm = { type: "running", minutes: "30", seconds: "0", distance: "", heartRate: "", heartRateMax: "", perceivedEffort: "", calories: "", notes: "", linkProgram: true };

  async function cargar() {
    setIsLoading(true);
    const [{ data }, { data: profile }, program] = await Promise.all([
      supabase.from("cardio_logs").select("*").order("created_at", { ascending: false }).limit(30),
      supabase.from("profiles").select("birth_year, max_heart_rate").eq("id", user!.id).maybeSingle(),
      fetchActiveProgram(),
    ]);
    setLogs((data || []) as unknown as CardioLog[]);
    setMaxHr(estimateMaxHeartRate({ birthYear: profile?.birth_year, overrideMax: profile?.max_heart_rate, currentYear: new Date().getFullYear() }));
    setActiveProgram(program);
    setIsLoading(false);
  }

  async function guardar() {
    setError(null);
    setIsSaving(true);
    const duration = Number(form.minutes) * 60 + Number(form.seconds);
    if (!duration || duration <= 0) { setError("Ingresa una duración válida."); setIsSaving(false); return; }

    const { error: saveError } = await supabase.from("cardio_logs").insert({
      type: form.type,
      duration_seconds: duration,
      distance_meters: form.distance ? Number(form.distance) : null,
      heart_rate_avg: form.heartRate ? Number(form.heartRate) : null,
      heart_rate_max: form.heartRateMax ? Number(form.heartRateMax) : null,
      perceived_effort: form.perceivedEffort ? Number(form.perceivedEffort) : null,
      program_id: form.linkProgram && activeProgram ? activeProgram.id : null,
      calories: form.calories ? Number(form.calories) : null,
      notes: form.notes || null,
      user_id: user!.id,
    } as any);

    if (saveError) { setError(saveError.message); } else {
      setShowForm(false);
      setForm(emptyForm);
      await cargar();
    }
    setIsSaving(false);
  }

  async function borrar(id: string) {
    setDeletingId(id);
    await supabase.from("cardio_logs").delete().eq("id", id);
    setLogs((c) => c.filter((l) => l.id !== id));
    setDeletingId(null);
  }

  const totalDuration = logs.reduce((s, l) => s + l.duration_seconds, 0);
  const totalDistance = logs.reduce((s, l) => s + Number(l.distance_meters || 0), 0);

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-24 font-sans max-w-md mx-auto">
      <Link href="/progreso" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6"><ArrowLeft className="h-4 w-4" /> Progreso</Link>

      <header className="mb-6">
        <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Cardio</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">Sesiones de cardio</h1>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#CCFF00]" /></div>
      )}
      {!isLoading && (
        <>

      {!user && (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Inicia sesión primero</h2>
          <p className="text-sm text-zinc-400 mt-2">Crea usuario o inicia sesión para registrar sesiones de cardio.</p>
          <Link href="/auth" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">Ir a login</Link>
        </section>
      )}

      {user && (
        <>
          {logs.length > 0 && (
            <section className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Sesiones</p>
                <p className="text-xl font-black mt-1">{logs.length}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-[10px] text-zinc-500 uppercase font-bold">Tiempo total</p>
                <p className="text-xl font-black mt-1">{formatDuration(totalDuration)}</p>
              </div>
            </section>
          )}

          <button onClick={() => setShowForm((v) => !v)} className="mb-6 w-full rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black inline-flex items-center justify-center gap-2">
            <Plus className="h-5 w-5" /> {showForm ? "Cancelar" : "Registrar sesión"}
          </button>

          {showForm && (
            <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm">
                  <span className="text-zinc-400">Tipo</span>
                  <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]">
                    {Object.entries(CARDIO_TYPES).map(([key, { label }]) => (<option key={key} value={key}>{label}</option>))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-sm">
                    <span className="text-zinc-400">Minutos</span>
                    <input value={form.minutes} onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))} inputMode="numeric" className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]" />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-zinc-400">Segundos</span>
                    <input value={form.seconds} onChange={(e) => setForm((f) => ({ ...f, seconds: e.target.value }))} inputMode="numeric" className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]" />
                  </label>
                </div>
                <label className="grid gap-1 text-sm">
                  <span className="text-zinc-400">Distancia (km)</span>
                  <input value={form.distance} onChange={(e) => setForm((f) => ({ ...f, distance: e.target.value }))} inputMode="decimal" placeholder="Opcional" className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-sm">
                    <span className="text-zinc-400">FC media (ppm)</span>
                    <input value={form.heartRate} onChange={(e) => setForm((f) => ({ ...f, heartRate: e.target.value }))} inputMode="numeric" placeholder="Opcional" className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]" />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-zinc-400">Calorías (kcal)</span>
                    <input value={form.calories} onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value }))} inputMode="numeric" placeholder="Opcional" className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]" />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-sm">
                    <span className="text-zinc-400">FC máx (ppm)</span>
                    <input value={form.heartRateMax} onChange={(e) => setForm((f) => ({ ...f, heartRateMax: e.target.value }))} inputMode="numeric" placeholder="Opcional" className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]" />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-zinc-400">Esfuerzo (1-10)</span>
                    <input value={form.perceivedEffort} onChange={(e) => setForm((f) => ({ ...f, perceivedEffort: e.target.value }))} inputMode="numeric" placeholder="Opcional" className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]" />
                  </label>
                </div>
                {activeProgram && (
                  <label className="flex items-center gap-2 text-sm text-zinc-300">
                    <input type="checkbox" checked={form.linkProgram} onChange={(e) => setForm((f) => ({ ...f, linkProgram: e.target.checked }))} className="h-4 w-4 accent-[#CCFF00]" />
                    Asociar a “{activeProgram.name}” (semana {activeProgram.currentWeek})
                  </label>
                )}
                <label className="grid gap-1 text-sm">
                  <span className="text-zinc-400">Notas</span>
                  <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Opcional" className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]" />
                </label>
                {error && <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>}
                <button onClick={guardar} disabled={isSaving} className="w-full rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black inline-flex items-center justify-center gap-2 disabled:opacity-60">
                  {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : null} {isSaving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </section>
          )}

          {logs.length > 0 && (
            <section className="grid gap-3">
              {logs.map((log) => {
                const Icon = CARDIO_TYPES[log.type]?.icon || Timer;
                const zone = classifyHeartRateZone(log.heart_rate_max ?? log.heart_rate_avg, maxHr);
                return (
                  <article key={log.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Icon className="h-4 w-4 text-[#CCFF00]" />
                          <p className="text-sm font-bold">{CARDIO_TYPES[log.type]?.label || log.type}</p>
                          {zone && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#CCFF00]/15 px-2 py-0.5 text-[10px] font-bold text-[#CCFF00]">
                              <HeartPulse className="h-3 w-3" /> {zone.label}
                            </span>
                          )}
                          {log.program_id && (
                            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-300">En programa</span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">
                          {[
                            formatDate(log.created_at),
                            formatDuration(log.duration_seconds),
                            log.distance_meters ? `${log.distance_meters} km` : null,
                            log.heart_rate_avg ? `${log.heart_rate_avg} ppm` : null,
                            log.perceived_effort ? `RPE ${log.perceived_effort}` : null,
                            log.calories ? `${log.calories} kcal` : null,
                          ].filter(Boolean).join(" · ")}
                        </p>
                        {log.notes && <p className="text-xs text-zinc-400 mt-1">{log.notes}</p>}
                      </div>
                      <button onClick={() => void borrar(log.id)} disabled={deletingId === log.id} className="shrink-0 text-zinc-500 hover:text-red-400 p-1">
                        {deletingId === log.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          )}

          {!isLoading && logs.length === 0 && !showForm && (
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 text-center">
              <h2 className="text-xl font-black">Sin sesiones</h2>
              <p className="text-sm text-zinc-400 mt-2">Registra tu primera sesión de cardio.</p>
            </section>
          )}
        </>
      )}
        </>
      )}
    </main>
  );
}
