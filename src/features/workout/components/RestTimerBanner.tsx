import { Timer, X } from "lucide-react";
import { formatRestTime } from "../domain/workoutMetrics";

type RestTimerBannerProps = {
  secondsLeft: number;
  onDismiss: () => void;
};

export function RestTimerBanner({ secondsLeft, onDismiss }: RestTimerBannerProps) {
  return (
    <div className="fixed bottom-20 left-0 right-0 z-40 mx-auto max-w-md px-6">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#CCFF00]/40 bg-black/95 p-4 shadow-lg shadow-black/50 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-[#CCFF00]" />
          <div>
            <p className="text-[10px] uppercase font-bold text-zinc-400">Descanso</p>
            <p className="text-xl font-black">{secondsLeft > 0 ? formatRestTime(secondsLeft) : "¡Listo!"}</p>
          </div>
        </div>
        <button type="button" onClick={onDismiss} className="rounded-full bg-zinc-900 p-2 text-zinc-400">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
