import { Loader2, Wand2 } from "lucide-react";

type RegeneratePanelProps = {
  instructions: string;
  onInstructionsChange: (value: string) => void;
  isRegenerating: boolean;
  onRegenerate: () => void;
  onCancel: () => void;
};

export function RegeneratePanel({ instructions, onInstructionsChange, isRegenerating, onRegenerate, onCancel }: RegeneratePanelProps) {
  return (
    <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs uppercase font-bold text-zinc-400 mb-2">Regenerar este día con IA</p>
      <p className="text-xs text-zinc-500 mb-3">Reemplaza los ejercicios de este día. El título y la rutina se mantienen en la misma URL.</p>
      <textarea
        value={instructions}
        onChange={(event) => onInstructionsChange(event.target.value)}
        rows={2}
        placeholder="Opcional: ej. más énfasis en espalda, evitar sentadilla"
        className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-[#CCFF00] resize-none"
      />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={isRegenerating}
          onClick={onRegenerate}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#CCFF00] py-2 text-sm font-black text-black disabled:opacity-50"
        >
          {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {isRegenerating ? "Regenerando..." : "Regenerar"}
        </button>
        <button type="button" onClick={onCancel} className="flex-1 rounded-2xl bg-zinc-900 py-2 text-sm font-bold text-zinc-300">
          Cancelar
        </button>
      </div>
    </div>
  );
}
