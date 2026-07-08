"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/SessionProvider";
import { EQUIPMENT_AVAILABILITY, EXPERIENCE_LEVELS, TRAINING_GOALS } from "@/lib/profileOptions";

type ProfileForm = {
  trainingGoal: string;
  injuryNotes: string;
  equipmentAvailable: string;
  experienceLevel: string;
};

const emptyForm: ProfileForm = {
  trainingGoal: "",
  injuryNotes: "",
  equipmentAvailable: "",
  experienceLevel: "",
};

export default function PerfilPage() {
  const { user, isLoading: isSessionLoading } = useSession();
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isSessionLoading) return;

    if (!user) {
      setIsLoading(false);
      return;
    }

    const userId = user.id;

    async function loadProfile() {
      setIsLoading(true);
      setError(null);

      const { data, error: loadError } = await supabase
        .from("profiles")
        .select("training_goal, injury_notes, equipment_available, experience_level")
        .eq("id", userId)
        .single();

      if (loadError) {
        setError(loadError.message);
      } else if (data) {
        setForm({
          trainingGoal: data.training_goal || "",
          injuryNotes: data.injury_notes || "",
          equipmentAvailable: data.equipment_available || "",
          experienceLevel: data.experience_level || "",
        });
      }

      setIsLoading(false);
    }

    void loadProfile();
  }, [user, isSessionLoading]);

  async function guardarPerfil() {
    if (!user) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        training_goal: form.trainingGoal || null,
        injury_notes: form.injuryNotes.trim() || null,
        equipment_available: form.equipmentAvailable || null,
        experience_level: form.experienceLevel || null,
      })
      .eq("id", user.id);

    setIsSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccessMessage("Perfil guardado. Tus próximas rutinas generadas lo tendrán en cuenta.");
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-28 font-sans max-w-md mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <header className="mb-8">
        <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Perfil</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">Tus preferencias</h1>
        <p className="text-sm text-zinc-400 mt-2">
          Objetivo, lesiones y equipo disponible se guardan una vez y se aplican automáticamente cada vez que generes una
          rutina — no hace falta retipearlos.
        </p>
      </header>

      {!user && !isSessionLoading && (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-black">Inicia sesión primero</h2>
          <p className="text-sm text-zinc-400 mt-2">Crea usuario o inicia sesión para configurar tu perfil.</p>
          <Link href="/auth" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">
            Ir a login
          </Link>
        </section>
      )}

      {(isSessionLoading || isLoading) && user && (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#CCFF00] mx-auto" />
        </div>
      )}

      {user && !isLoading && (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="text-zinc-400">Objetivo de entrenamiento</span>
              <select
                value={form.trainingGoal}
                onChange={(event) => setForm((current) => ({ ...current, trainingGoal: event.target.value }))}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]"
              >
                <option value="">Sin especificar</option>
                {TRAINING_GOALS.map((goal) => (
                  <option key={goal} value={goal}>
                    {goal}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-zinc-400">Nivel de experiencia</span>
              <select
                value={form.experienceLevel}
                onChange={(event) => setForm((current) => ({ ...current, experienceLevel: event.target.value }))}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]"
              >
                <option value="">Sin especificar</option>
                {EXPERIENCE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-zinc-400">Equipo disponible</span>
              <select
                value={form.equipmentAvailable}
                onChange={(event) => setForm((current) => ({ ...current, equipmentAvailable: event.target.value }))}
                className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]"
              >
                <option value="">Sin especificar</option>
                {EQUIPMENT_AVAILABILITY.map((equipment) => (
                  <option key={equipment} value={equipment}>
                    {equipment}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-zinc-400">Lesiones o restricciones persistentes</span>
              <textarea
                value={form.injuryNotes}
                onChange={(event) => setForm((current) => ({ ...current, injuryNotes: event.target.value }))}
                rows={3}
                placeholder="Ej: molestia en el hombro derecho, evitar sentadilla libre"
                className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00] resize-none"
              />
            </label>

            <button
              onClick={guardarPerfil}
              disabled={isSaving}
              className="w-full rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {isSaving ? "Guardando..." : "Guardar perfil"}
            </button>

            <div className="mt-6 pt-4 border-t border-zinc-800">
              <a
                href="/api/user/export"
                className="w-full rounded-2xl bg-zinc-900 border border-zinc-800 px-4 py-3 font-bold text-zinc-300 inline-flex items-center justify-center gap-2 hover:bg-zinc-800"
              >
                Exportar mis datos
              </a>
              <p className="text-[10px] text-zinc-600 mt-2 text-center">
                Descarga un archivo JSON con tus rutinas, entrenamientos, series, medidas y récords.
              </p>
            </div>
          </div>

          {successMessage && (
            <div className="mt-4 rounded-2xl border border-lime-900/60 bg-lime-950/40 p-4 text-sm text-lime-200 inline-flex gap-2">
              <CheckCircle2 className="h-5 w-5 shrink-0" /> {successMessage}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>
          )}
        </section>
      )}
    </main>
  );
}
