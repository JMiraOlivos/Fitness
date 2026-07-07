import { formatKg } from "@/lib/dashboardMetrics";
import type { DashboardMetrics } from "../types";

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
      <p className="text-xs text-zinc-500 uppercase font-bold">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

type WeeklyMetricsProps = {
  metrics: DashboardMetrics;
  isLoading: boolean;
};

export function WeeklyMetrics({ metrics, isLoading }: WeeklyMetricsProps) {
  return (
    <>
      <section className="grid grid-cols-2 gap-4 mb-4">
        <MetricCard label="Volumen semana" value={isLoading ? "..." : `${formatKg(metrics.weeklyVolume)} kg`} />
        <MetricCard label="Series semana" value={isLoading ? "..." : String(metrics.weeklySets)} />
        <MetricCard label="Workouts" value={isLoading ? "..." : String(metrics.weeklyWorkouts)} />
        <MetricCard label="Racha" value={isLoading ? "..." : `${metrics.currentStreak} días`} />
      </section>

      <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs text-zinc-500">
        Último entrenamiento: <span className="font-bold text-zinc-300">{isLoading ? "Cargando..." : metrics.lastWorkoutLabel}</span>
      </section>
    </>
  );
}
