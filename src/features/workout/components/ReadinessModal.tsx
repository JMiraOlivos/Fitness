import { X } from "lucide-react";
import { AVAILABLE_MINUTES_OPTIONS } from "../domain/workoutMetrics";
import type { ReadinessForm } from "../types";

type ReadinessModalProps = {
  form: ReadinessForm;
  onFormChange: (patch: Partial<ReadinessForm>) => void;
  onAdapt: () => void;
  onSkip: () => void;
  onClose: () => void;
};

function ScaleButtons({ value, onSelect }: { value: number; onSelect: (next: number) => void }) {
  return (
    <div className="mt-2 grid grid-cols-5 gap-2">
      {[1, 2, 3, 4, 5].map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          className={`rounded-xl py-2 text-sm font-black ${value === option ? "bg-[#CCFF00] text-black" : "bg-zinc-900 text-zinc-400"}`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function ReadinessModal({ form, onFormChange, onAdapt, onSkip, onClose }: ReadinessModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 p-6 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Antes de partir</h2>
            <p className="mt-1 text-xs text-zinc-500">Cuéntanos cómo llegas hoy — toma menos de 20 segundos.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-full bg-zinc-900 p-2 text-zinc-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5">
          <p className="text-xs font-bold uppercase text-zinc-400">Energía</p>
          <ScaleButtons value={form.energy} onSelect={(energy) => onFormChange({ energy })} />
        </div>

        <div className="mt-4">
          <p className="text-xs font-bold uppercase text-zinc-400">Sueño</p>
          <ScaleButtons value={form.sleepQuality} onSelect={(sleepQuality) => onFormChange({ sleepQuality })} />
        </div>

        <div className="mt-4">
          <p className="text-xs font-bold uppercase text-zinc-400">Dolor muscular</p>
          <ScaleButtons value={form.soreness} onSelect={(soreness) => onFormChange({ soreness })} />
        </div>

        <div className="mt-4">
          <p className="text-xs font-bold uppercase text-zinc-400">Dolor articular</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onFormChange({ jointPain: false })}
              className={`rounded-xl py-2 text-sm font-black ${!form.jointPain ? "bg-[#CCFF00] text-black" : "bg-zinc-900 text-zinc-400"}`}
            >
              No
            </button>
            <button
              type="button"
              onClick={() => onFormChange({ jointPain: true })}
              className={`rounded-xl py-2 text-sm font-black ${form.jointPain ? "bg-[#CCFF00] text-black" : "bg-zinc-900 text-zinc-400"}`}
            >
              Sí
            </button>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-xs font-bold uppercase text-zinc-400">Tiempo disponible</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {AVAILABLE_MINUTES_OPTIONS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => onFormChange({ availableMinutes: minutes })}
                className={`rounded-xl py-2 text-sm font-black ${
                  form.availableMinutes === minutes ? "bg-[#CCFF00] text-black" : "bg-zinc-900 text-zinc-400"
                }`}
              >
                {minutes}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 grid gap-1 text-xs text-zinc-400">
          Nota opcional
          <textarea
            value={form.notes}
            onChange={(event) => onFormChange({ notes: event.target.value })}
            rows={2}
            placeholder="Ej: dolor de hombro, mala noche de sueño..."
            className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-white outline-none focus:border-[#CCFF00] resize-none"
          />
        </label>

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onAdapt} className="flex-1 rounded-2xl bg-[#CCFF00] py-3 text-sm font-black text-black">
            Adaptar entrenamiento
          </button>
          <button type="button" onClick={onSkip} className="flex-1 rounded-2xl bg-zinc-900 py-3 text-sm font-bold text-zinc-300">
            Entrenar igual
          </button>
        </div>
      </div>
    </div>
  );
}
