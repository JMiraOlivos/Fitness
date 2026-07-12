"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Droplet, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/SessionProvider";

const WATER_GOAL_ML = 2500;

type NutritionLog = {
  id: string;
  log_date: string;
  water_ml: number | null;
  protein_g: number | null;
  calories: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function today() {
  return new Date().toLocaleDateString("en-CA");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

export default function NutricionPage() {
  const { user, isLoading: isSessionLoading } = useSession();
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<{ water: string; protein: string; calories: string; notes: string }>({ water: "", protein: "", calories: "", notes: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isSessionLoading) return;
    if (!user) { setIsLoading(false); return; }
    void cargar();
  }, [user, isSessionLoading]);

  async function cargar() {
    setIsLoading(true);
    const { data } = await supabase.from("daily_nutrition_logs").select("*").order("log_date", { ascending: false }).limit(14);
    const rows = (data || []) as unknown as NutritionLog[];
    setLogs(rows);
    const hoy = today();
    const current = rows.find((l) => l.log_date === hoy);
    if (current) {
      setForm({
        water: current.water_ml != null ? String(current.water_ml) : "",
        protein: current.protein_g != null ? String(current.protein_g) : "",
        calories: current.calories != null ? String(current.calories) : "",
        notes: current.notes || "",
      });
    }
    setIsLoading(false);
  }

  async function guardar() {
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    const hoy = today();

    const { error: saveError } = await supabase.from("daily_nutrition_logs").upsert({
      user_id: user!.id,
      log_date: hoy,
      water_ml: form.water === "" ? null : Number(form.water),
      protein_g: form.protein === "" ? null : Number(form.protein),
      calories: form.calories === "" ? null : Number(form.calories),
      notes: form.notes || null,
    } as any, { onConflict: "user_id,log_date" });

    if (saveError) { setError(saveError.message); } else {
      setSuccess("Registro guardado.");
      await cargar();
    }
    setIsSaving(false);
  }

  async function borrar(id: string) {
    setDeletingId(id);
    await supabase.from("daily_nutrition_logs").delete().eq("id", id);
    setLogs((c) => c.filter((l) => l.id !== id));
    setDeletingId(null);
  }

  const hoy = today();
  const todayLog = logs.find((l) => l.log_date === hoy);
  const waterToday = todayLog?.water_ml ?? (form.water === "" ? 0 : Number(form.water) || 0);
  const waterPct = Math.min(100, Math.round((waterToday / WATER_GOAL_ML) * 100));

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-24 font-sans max-w-md mx-auto">
      <Link href="/progreso" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6"><ArrowLeft className="h-4 w-4" /> Progreso</Link>

      <header className="mb-6">
        <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Nutrición</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">Hidratación y nutrición</h1>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-[#CCFF00]" /></div>
      )}
      {!isLoading && (
        <>

      {!user && (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Inicia sesión primero</h2>
          <p className="text-sm text-zinc-400 mt-2">Crea usuario o inicia sesión para registrar tu nutrición e hidratación.</p>
          <Link href="/auth" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">Ir a login</Link>
        </section>
      )}

      {user && (
        <>
          <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Droplet className="h-4 w-4 text-[#CCFF00]" />
              <p className="text-sm font-bold">Objetivo de hidratación</p>
            </div>
            <div className="h-3 w-full rounded-full bg-zinc-900 overflow-hidden">
              <div className="h-full rounded-full bg-[#CCFF00]" style={{ width: `${waterPct}%` }} />
            </div>
            <p className="text-xs text-zinc-500 mt-2">{waterToday} / {WATER_GOAL_ML} ml</p>
          </section>

          <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-sm">
                  <span className="text-zinc-400">Agua (ml)</span>
                  <input value={form.water} onChange={(e) => setForm((f) => ({ ...f, water: e.target.value }))} inputMode="numeric" placeholder="Opcional" className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]" />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="text-zinc-400">Proteína (g)</span>
                  <input value={form.protein} onChange={(e) => setForm((f) => ({ ...f, protein: e.target.value }))} inputMode="numeric" placeholder="Opcional" className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]" />
                </label>
              </div>
              <label className="grid gap-1 text-sm">
                <span className="text-zinc-400">Calorías (kcal)</span>
                <input value={form.calories} onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value }))} inputMode="numeric" placeholder="Opcional" className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-zinc-400">Notas</span>
                <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Opcional" className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]" />
              </label>
              {error && <div className="rounded-2xl border border-red-900/60 bg-red-950/40 p-3 text-sm text-red-200">{error}</div>}
              {success && <div className="rounded-2xl border border-[#CCFF00]/40 bg-[#CCFF00]/10 p-3 text-sm text-[#CCFF00]">{success}</div>}
              <button onClick={guardar} disabled={isSaving} className="w-full rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />} {isSaving ? "Guardando..." : "Guardar registro de hoy"}
              </button>
            </div>
          </section>

          {logs.length > 0 && (
            <section className="grid gap-3">
              {logs.map((log) => {
                const parts = [
                  log.water_ml != null ? `${log.water_ml} ml` : null,
                  log.protein_g != null ? `${log.protein_g} g proteína` : null,
                  log.calories != null ? `${log.calories} kcal` : null,
                ].filter(Boolean);
                return (
                  <article key={log.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{formatDate(log.log_date)}</p>
                        <p className="text-xs text-zinc-500 mt-1">{parts.length > 0 ? parts.join(" · ") : "Sin valores"}</p>
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

          {logs.length === 0 && (
            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 text-center">
              <h2 className="text-xl font-black">Sin registros</h2>
              <p className="text-sm text-zinc-400 mt-2">Registra tu primer día de nutrición e hidratación.</p>
            </section>
          )}
        </>
      )}
        </>
      )}
    </main>
  );
}
