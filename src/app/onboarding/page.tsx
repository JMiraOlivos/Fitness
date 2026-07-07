"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Save, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/SessionProvider";
import { authFetch } from "@/lib/authFetch";
import { EQUIPMENT_AVAILABILITY, EXPERIENCE_LEVELS, TRAINING_GOALS } from "@/lib/profileOptions";
import { generateRoutine, saveRoutine } from "@/features/dashboard/data/dashboardMutations";
import type { RutinaIA } from "@/features/dashboard/types";

const RESTRICTION_ZONES = ["Hombro", "Rodilla", "Espalda baja", "Cadera"] as const;

const STEPS = ["objetivo", "nivel", "equipo", "restricciones", "dias", "generar"] as const;

type Step = (typeof STEPS)[number];

function ProgressBar({ step }: { step: Step }) {
  const index = STEPS.indexOf(step);
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
        <span>
          Paso {index + 1} de {STEPS.length}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
        <div
          className="h-full rounded-full bg-[#CCFF00] transition-all"
          style={{ width: `${((index + 1) / STEPS.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

function ChoiceButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl px-4 py-4 text-left font-bold ${
        selected ? "bg-[#CCFF00] text-black" : "bg-zinc-900 text-zinc-300 border border-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

export default function OnboardingPage() {
  const { user } = useSession();
  const router = useRouter();

  const [step, setStep] = useState<Step>("objetivo");
  const [trainingGoal, setTrainingGoal] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [equipmentAvailable, setEquipmentAvailable] = useState("");
  const [restrictionZones, setRestrictionZones] = useState<Set<string>>(new Set());
  const [otherRestriction, setOtherRestriction] = useState("");
  const [diasDisponibles, setDiasDisponibles] = useState("4");

  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rutinasGeneradas, setRutinasGeneradas] = useState<RutinaIA[]>([]);
  const [savedIndexes, setSavedIndexes] = useState<Set<number>>(new Set());
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  function goToNextStep() {
    const currentIndex = STEPS.indexOf(step);
    setStep(STEPS[Math.min(currentIndex + 1, STEPS.length - 1)]);
  }

  function goToPreviousStep() {
    const currentIndex = STEPS.indexOf(step);
    setStep(STEPS[Math.max(currentIndex - 1, 0)]);
  }

  function toggleRestrictionZone(zone: string) {
    setRestrictionZones((current) => {
      const next = new Set(current);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });
  }

  const injuryNotes = [...[...restrictionZones].map((zone) => `Molestia en ${zone.toLowerCase()}`), otherRestriction.trim()]
    .filter(Boolean)
    .join(". ");

  async function generarPrimerPlan() {
    if (!user) return;

    setError(null);
    setIsSaving(true);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        training_goal: trainingGoal || null,
        experience_level: experienceLevel || null,
        equipment_available: equipmentAvailable || null,
        injury_notes: injuryNotes || null,
      })
      .eq("id", user.id);

    setIsSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setIsGenerating(true);

    try {
      const { rutinas } = await generateRoutine({
        diasDisponibles: Number(diasDisponibles),
        enfoque: trainingGoal || "Hipertrofia",
        restricciones: injuryNotes || "Sin restricciones",
      });
      setRutinasGeneradas(rutinas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar tu primera rutina.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function guardarDia(rutina: RutinaIA, index: number) {
    setError(null);
    setSavingIndex(index);

    try {
      await saveRoutine(rutina);
      setSavedIndexes((current) => new Set(current).add(index));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la rutina.");
    } finally {
      setSavingIndex(null);
    }
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-black text-white p-6 max-w-md mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-8">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h1 className="text-2xl font-black">Inicia sesión primero</h1>
          <p className="mt-2 text-sm text-zinc-400">Crea usuario o inicia sesión para configurar tu perfil.</p>
          <Link href="/auth" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">
            Ir a login
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-16 font-sans max-w-md mx-auto">
      {step !== "generar" ? (
        <button onClick={goToPreviousStep} className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6">
          <ArrowLeft className="h-4 w-4" /> Atrás
        </button>
      ) : (
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
      )}

      <ProgressBar step={step} />

      {step === "objetivo" && (
        <section>
          <h1 className="text-2xl font-black">¿Qué quieres lograr?</h1>
          <p className="mt-2 text-sm text-zinc-400">Usaremos esto para orientar tus rutinas.</p>
          <div className="mt-6 grid gap-3">
            {TRAINING_GOALS.map((goal) => (
              <ChoiceButton key={goal} selected={trainingGoal === goal} onClick={() => setTrainingGoal(goal)}>
                {goal}
              </ChoiceButton>
            ))}
          </div>
          <button onClick={goToNextStep} disabled={!trainingGoal} className="mt-6 w-full rounded-2xl bg-white px-4 py-3 font-black text-black disabled:opacity-40">
            Continuar
          </button>
        </section>
      )}

      {step === "nivel" && (
        <section>
          <h1 className="text-2xl font-black">¿Cuál es tu experiencia?</h1>
          <div className="mt-6 grid gap-3">
            {EXPERIENCE_LEVELS.map((level) => (
              <ChoiceButton key={level} selected={experienceLevel === level} onClick={() => setExperienceLevel(level)}>
                {level}
              </ChoiceButton>
            ))}
          </div>
          <button onClick={goToNextStep} disabled={!experienceLevel} className="mt-6 w-full rounded-2xl bg-white px-4 py-3 font-black text-black disabled:opacity-40">
            Continuar
          </button>
        </section>
      )}

      {step === "equipo" && (
        <section>
          <h1 className="text-2xl font-black">¿Dónde entrenas?</h1>
          <div className="mt-6 grid gap-3">
            {EQUIPMENT_AVAILABILITY.map((equipment) => (
              <ChoiceButton key={equipment} selected={equipmentAvailable === equipment} onClick={() => setEquipmentAvailable(equipment)}>
                {equipment}
              </ChoiceButton>
            ))}
          </div>
          <button onClick={goToNextStep} disabled={!equipmentAvailable} className="mt-6 w-full rounded-2xl bg-white px-4 py-3 font-black text-black disabled:opacity-40">
            Continuar
          </button>
        </section>
      )}

      {step === "restricciones" && (
        <section>
          <h1 className="text-2xl font-black">¿Hay algo que debamos evitar?</h1>
          <p className="mt-2 text-sm text-zinc-400">Selecciona todas las que apliquen, o sáltalo si no hay ninguna.</p>
          <div className="mt-6 grid gap-3">
            {RESTRICTION_ZONES.map((zone) => (
              <ChoiceButton key={zone} selected={restrictionZones.has(zone)} onClick={() => toggleRestrictionZone(zone)}>
                {zone}
              </ChoiceButton>
            ))}
          </div>
          <label className="mt-4 grid gap-1 text-sm">
            <span className="text-zinc-400">Otro (opcional)</span>
            <textarea
              value={otherRestriction}
              onChange={(event) => setOtherRestriction(event.target.value)}
              rows={2}
              placeholder="Cuéntanos algo más si hace falta"
              className="rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-[#CCFF00] resize-none"
            />
          </label>
          <button onClick={goToNextStep} className="mt-6 w-full rounded-2xl bg-white px-4 py-3 font-black text-black">
            Continuar
          </button>
        </section>
      )}

      {step === "dias" && (
        <section>
          <h1 className="text-2xl font-black">¿Cuántos días a la semana?</h1>
          <div className="mt-6 grid grid-cols-4 gap-3">
            {["2", "3", "4", "5"].map((dias) => (
              <ChoiceButton key={dias} selected={diasDisponibles === dias} onClick={() => setDiasDisponibles(dias)}>
                <span className="block text-center">{dias}</span>
              </ChoiceButton>
            ))}
          </div>
          <button
            onClick={() => {
              goToNextStep();
              void generarPrimerPlan();
            }}
            className="mt-6 w-full rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black inline-flex items-center justify-center gap-2"
          >
            <Sparkles className="h-5 w-5" /> Generar mi primer plan
          </button>
        </section>
      )}

      {step === "generar" && (
        <section>
          {(isSaving || isGenerating) && (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#CCFF00] mx-auto" />
              <p className="mt-3 text-sm text-zinc-400">Creando tu primer plan a medida...</p>
            </div>
          )}

          {error && <div className="mb-4 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>}

          {!isSaving && !isGenerating && rutinasGeneradas.length > 0 && (
            <>
              <h1 className="text-2xl font-black">Tu plan está listo</h1>
              <p className="mt-2 text-sm text-zinc-400">Guarda los días que quieras empezar a entrenar.</p>
              <div className="mt-6 grid gap-4">
                {rutinasGeneradas.map((rutina, index) => (
                  <article key={`${rutina.titulo}-${index}`} className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-[#CCFF00] font-bold uppercase">Día {index + 1}</p>
                        <h2 className="text-lg font-black">{rutina.titulo}</h2>
                        <p className="text-sm text-zinc-400 mt-1">{rutina.descripcion}</p>
                      </div>
                      <button
                        onClick={() => guardarDia(rutina, index)}
                        disabled={savingIndex === index || savedIndexes.has(index)}
                        className="shrink-0 rounded-full bg-zinc-900 p-3 text-[#CCFF00] disabled:opacity-40"
                      >
                        {savingIndex === index ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : savedIndexes.has(index) ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Save className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <Link href="/" className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 font-black text-black">
                Ir al dashboard
              </Link>
            </>
          )}
        </section>
      )}
    </main>
  );
}
