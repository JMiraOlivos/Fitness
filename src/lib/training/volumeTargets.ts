// Weekly working-set volume landmarks per muscle group (ROADMAP.md, Fase vNext 7).
// Approximate hypertrophy ranges (MEV-ish floor, MRV-ish ceiling) commonly cited in
// strength/hypertrophy literature — a reasonable default, not a personalized
// prescription. Deliberately conservative; revisit once per-user targets exist.
import { MUSCLE_GROUPS } from "@/lib/exerciseTaxonomy";

export type VolumeRange = { min: number; max: number };

export const MUSCLE_GROUP_VOLUME_TARGETS: Record<(typeof MUSCLE_GROUPS)[number], VolumeRange> = {
  Pecho: { min: 10, max: 20 },
  Espalda: { min: 10, max: 20 },
  Hombro: { min: 8, max: 16 },
  Bíceps: { min: 6, max: 14 },
  Tríceps: { min: 6, max: 14 },
  Antebrazo: { min: 4, max: 10 },
  Cuádriceps: { min: 8, max: 16 },
  Isquiotibiales: { min: 6, max: 14 },
  Glúteo: { min: 6, max: 14 },
  Pantorrilla: { min: 6, max: 16 },
  Core: { min: 6, max: 16 },
  Trapecio: { min: 4, max: 10 },
};

export type VolumeStatus = "bajo" | "correcto" | "alto" | "desconocido";

export function classifyVolume(muscleGroup: string, sets: number): VolumeStatus {
  const target = MUSCLE_GROUP_VOLUME_TARGETS[muscleGroup as (typeof MUSCLE_GROUPS)[number]];
  if (!target) return "desconocido";

  if (sets < target.min) return "bajo";
  if (sets > target.max) return "alto";
  return "correcto";
}
