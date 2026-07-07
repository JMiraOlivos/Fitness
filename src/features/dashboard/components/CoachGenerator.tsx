import { BrainCircuit, CheckCircle2, Loader2, Save, Sparkles } from "lucide-react";
import { AiFeedback } from "@/components/AiFeedback";
import type { EjercicioIA, RutinaIA } from "../types";

function ExercisePreview({ ejercicios }: { ejercicios: EjercicioIA[] }) {
  return (
    <div className="grid gap-3">
      {ejercicios.map((ejercicio, index) => (
        <div key={`${ejercicio.nombre}-${index}`} className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h5 className="font-bold">{ejercicio.nombre}</h5>
              <p className="text-xs text-zinc-500">
                {ejercicio.musculoObjetivo} · {ejercicio.equipamiento}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-black text-[#CCFF00]">{ejercicio.seriesObjetivo}x</p>
              <p className="text-xs text-zinc-400">{ejercicio.repeticionesObjetivo}</p>
            </div>
          </div>
          <p className="text-xs text-zinc-400 mt-3">{ejercicio.notas}</p>
        </div>
      ))}
    </div>
  );
}

type CoachGeneratorProps = {
  diasDisponibles: string;
  onDiasDisponiblesChange: (value: string) => void;
  enfoque: string;
  onEnfoqueChange: (value: string) => void;
  restricciones: string;
  onRestriccionesChange: (value: string) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  error: string | null;
  successMessage: string | null;
  rutinasIA: RutinaIA[];
  isSaving: boolean;
  canSave: boolean;
  onSave: (rutina: RutinaIA) => void;
  generationId?: string | null;
};

export function CoachGenerator({
  diasDisponibles,
  onDiasDisponiblesChange,
  enfoque,
  onEnfoqueChange,
  restricciones,
  onRestriccionesChange,
  isGenerating,
  onGenerate,
  error,
  successMessage,
  rutinasIA,
  isSaving,
  canSave,
  onSave,
  generationId,
}: CoachGeneratorProps) {
  return (
    <>
      <section className="mb-8 bg-zinc-950 border border-zinc-800 rounded-3xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Coach IA</p>
            <h3 className="text-lg font-bold">Generar rutina</h3>
          </div>
          <BrainCircuit className="w-6 h-6 text-zinc-500" />
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-400">Días disponibles</span>
            <input
              value={diasDisponibles}
              onChange={(event) => onDiasDisponiblesChange(event.target.value)}
              inputMode="numeric"
              className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-400">Enfoque</span>
            <input
              value={enfoque}
              onChange={(event) => onEnfoqueChange(event.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-400">Restricciones</span>
            <textarea
              value={restricciones}
              onChange={(event) => onRestriccionesChange(event.target.value)}
              rows={3}
              placeholder="Ej: molestia en el hombro derecho, evitar sentadilla libre"
              className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00] resize-none"
            />
          </label>
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="w-full bg-[#CCFF00] text-black rounded-2xl py-3 font-black inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {isGenerating ? "Generando..." : "Crear rutina con IA"}
          </button>
        </div>

        {error && <div className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>}
        {successMessage && (
          <div className="mt-4 rounded-2xl border border-lime-900/60 bg-lime-950/40 p-4 text-sm text-lime-200 inline-flex gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0" /> {successMessage}
          </div>
        )}
      </section>

      {rutinasIA.length > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-bold mb-4">Rutinas generadas</h3>
          <div className="grid gap-4">
            {rutinasIA.map((rutina, index) => (
              <article key={`${rutina.titulo}-${index}`} className="bg-zinc-950 border border-zinc-800 rounded-3xl p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-[#CCFF00] font-bold uppercase">Día {index + 1}</p>
                    <h4 className="text-xl font-black">{rutina.titulo}</h4>
                    <p className="text-sm text-zinc-400 mt-1">{rutina.descripcion}</p>
                  </div>
                  <button
                    onClick={() => onSave(rutina)}
                    disabled={isSaving || !canSave}
                    className="rounded-full bg-zinc-900 p-3 text-[#CCFF00] disabled:opacity-40"
                  >
                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  </button>
                </div>
                <ExercisePreview ejercicios={rutina.ejercicios} />
              </article>
            ))}
          </div>
        </section>
      )}

      {generationId && <AiFeedback generationId={generationId} className="mb-4" />}
    </>
  );
}
