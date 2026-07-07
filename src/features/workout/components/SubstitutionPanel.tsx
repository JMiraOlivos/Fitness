import { Loader2 } from "lucide-react";
import type { ExerciseRow } from "../types";

type SubstitutionPanelProps = {
  targetMuscle: string;
  isLoading: boolean;
  options: ExerciseRow[];
  isSubstituting: boolean;
  onSelect: (option: ExerciseRow) => void;
  onCancel: () => void;
};

export function SubstitutionPanel({ targetMuscle, isLoading, options, isSubstituting, onSelect, onCancel }: SubstitutionPanelProps) {
  return (
    <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-3">
      <p className="text-[10px] uppercase font-bold text-zinc-400 mb-2">Sustituir por otro ejercicio de {targetMuscle || "este grupo muscular"}</p>

      {isLoading && <Loader2 className="h-5 w-5 animate-spin text-[#CCFF00] mx-auto my-2" />}

      {!isLoading && options.length === 0 && <p className="text-xs text-zinc-500">No hay otros ejercicios registrados para este grupo muscular.</p>}

      {!isLoading && options.length > 0 && (
        <div className="grid gap-2">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={isSubstituting}
              onClick={() => onSelect(option)}
              className="flex items-center justify-between rounded-xl bg-zinc-950 px-3 py-2 text-left text-xs disabled:opacity-50"
            >
              <span className="font-bold text-white">{option.name}</span>
              <span className="text-zinc-500">{option.equipment}</span>
            </button>
          ))}
        </div>
      )}

      <button type="button" onClick={onCancel} className="mt-2 text-xs font-bold text-zinc-500">
        Cancelar
      </button>
    </div>
  );
}
