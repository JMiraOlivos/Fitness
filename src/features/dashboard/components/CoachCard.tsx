import { Check, MessageCircle, Sparkles, X } from "lucide-react";
import type { CoachRecommendation } from "../types";

function severityColors(severity: CoachRecommendation["severity"]) {
  switch (severity) {
    case "critical":
      return { border: "border-red-500/40", bg: "bg-red-950/40", text: "text-red-300", badge: "bg-red-500/20 text-red-300" };
    case "warning":
      return { border: "border-amber-500/40", bg: "bg-amber-950/40", text: "text-amber-200", badge: "bg-amber-500/20 text-amber-300" };
    case "info":
    default:
      return { border: "border-[#CCFF00]/40", bg: "bg-[#CCFF00]/10", text: "text-zinc-200", badge: "bg-[#CCFF00]/20 text-[#CCFF00]" };
  }
}

function categoryLabel(category: CoachRecommendation["category"]) {
  switch (category) {
    case "volume_low": return "Volumen bajo";
    case "volume_high": return "Volumen alto";
    case "fatigue": return "Fatiga";
    case "adherence": return "Adherencia";
    case "general": return "General";
  }
}

type CoachCardProps = {
  recommendations: CoachRecommendation[];
  isLoading: boolean;
  onMarkRead: (id: string) => void;
  onDismissAll: () => void;
};

export function CoachCard({ recommendations, isLoading, onMarkRead, onDismissAll }: CoachCardProps) {
  const unread = recommendations.filter((r) => !r.is_read);

  if (!isLoading && unread.length === 0) return null;

  return (
    <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#CCFF00]" />
          <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Recomendaciones del coach</p>
          {unread.length > 0 && (
            <span className="rounded-full bg-[#CCFF00] px-2 py-0.5 text-[10px] font-black text-black">
              {unread.length}
            </span>
          )}
        </div>
        {unread.length > 0 && (
          <button
            onClick={onDismissAll}
            className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 inline-flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Descartar
          </button>
        )}
      </div>

      {isLoading && (
        <p className="text-xs text-zinc-500 italic flex items-center gap-2">
          <MessageCircle className="h-3.5 w-3.5" /> Cargando recomendaciones...
        </p>
      )}

      <div className="grid gap-2">
        {unread.map((rec) => {
          const colors = severityColors(rec.severity);
          return (
            <article key={rec.id} className={`rounded-2xl border ${colors.border} ${colors.bg} p-3`}>
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${colors.badge}`}>
                      {categoryLabel(rec.category)}
                    </span>
                  </div>
                  <p className={`text-sm ${colors.text}`}>{rec.message}</p>
                </div>
                <button
                  onClick={() => onMarkRead(rec.id)}
                  className="shrink-0 rounded-full p-1 text-zinc-500 hover:bg-zinc-800"
                  title="Marcar como leída"
                >
                  <Check className="h-4 w-4" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
