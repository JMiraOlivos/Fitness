import { Loader2, Plus } from "lucide-react";
import type { SetInput } from "../types";

type SetLoggerProps = {
  input: SetInput;
  onChange: (patch: Partial<SetInput>) => void;
  onAdjustWeight: (delta: number) => void;
  onAdjustReps: (delta: number) => void;
  onSubmit: () => void;
  isSaving: boolean;
};

export function SetLogger({ input, onChange, onAdjustWeight, onAdjustReps, onSubmit, isSaving }: SetLoggerProps) {
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <label className="grid gap-1 text-xs text-zinc-400">
          Peso
          <input
            value={input.weight}
            onChange={(event) => onChange({ weight: event.target.value })}
            inputMode="decimal"
            placeholder="kg"
            className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
          />
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Reps
          <input
            value={input.reps}
            onChange={(event) => onChange({ reps: event.target.value })}
            inputMode="numeric"
            placeholder="10"
            className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
          />
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          RPE
          <input
            value={input.rpe}
            onChange={(event) => onChange({ rpe: event.target.value })}
            inputMode="decimal"
            placeholder="8 o 8.5"
            className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
          />
        </label>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <label className="grid gap-1 text-xs text-zinc-400">
          RIR
          <input
            value={input.rir}
            onChange={(event) => onChange({ rir: event.target.value })}
            inputMode="decimal"
            placeholder="0-5"
            className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
          />
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          Lado
          <select
            value={input.side}
            onChange={(event) => onChange({ side: event.target.value as SetInput["side"] })}
            className="rounded-2xl border border-zinc-800 bg-zinc-900 px-2 py-3 text-white outline-none focus:border-[#CCFF00]"
          >
            <option value="both">Ambos</option>
            <option value="left">Izq.</option>
            <option value="right">Der.</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-zinc-400">
          TUT (s)
          <input
            value={input.tempoSeconds}
            onChange={(event) => onChange({ tempoSeconds: event.target.value })}
            inputMode="numeric"
            placeholder="opc."
            className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-[#CCFF00]"
          />
        </label>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <div className="flex gap-1">
          <button type="button" onClick={() => onAdjustWeight(-2.5)} className="flex-1 rounded-xl bg-zinc-900 py-2 text-xs font-bold text-zinc-300">
            -2.5
          </button>
          <button type="button" onClick={() => onAdjustWeight(2.5)} className="flex-1 rounded-xl bg-zinc-900 py-2 text-xs font-bold text-zinc-300">
            +2.5
          </button>
        </div>
        <button type="button" onClick={() => onAdjustReps(1)} className="rounded-xl bg-zinc-900 py-2 text-xs font-bold text-zinc-300">
          +1 rep
        </button>
        <div />
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={input.isWarmup}
          onChange={(event) => onChange({ isWarmup: event.target.checked })}
          className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-[#CCFF00]"
        />
        Serie de calentamiento (no cuenta en volumen/1RM/RPE)
      </label>

      <button
        onClick={onSubmit}
        disabled={isSaving}
        className="mt-3 w-full rounded-2xl bg-white px-4 py-3 font-black text-black inline-flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
        Registrar serie
      </button>
    </>
  );
}
