// Clasificación de una actividad de Strava por tipo y scoring de asociación con una
// sesión de fuerza (workout_logs). Funciones puras y testeables; la orquestación
// (queries, escrituras) vive en sync.ts.

import type { ActivityKind } from "./types";

// sport_type de Strava -> cómo lo tratamos en Fitness.
//   strength  -> se asocia a un workout_log existente (la sesión de pesas se registró
//                en la app; Strava solo aporta la FC).
//   cardio    -> se crea/asocia un cardio_log (la actividad ES el cardio).
//   other     -> queda en staging sin asociar.
const STRENGTH_TYPES = new Set([
  "WeightTraining",
  "Workout",
  "Crossfit",
  "HighIntensityIntervalTraining",
]);

const CARDIO_TYPES: Record<string, "running" | "cycling" | "walking" | "swimming" | "rowing"> = {
  Run: "running",
  TrailRun: "running",
  VirtualRun: "running",
  Ride: "cycling",
  VirtualRide: "cycling",
  MountainBikeRide: "cycling",
  GravelRide: "cycling",
  EBikeRide: "cycling",
  Walk: "walking",
  Hike: "walking",
  Swim: "swimming",
  Rowing: "rowing",
};

export function classifyActivity(sportType: string | null | undefined): ActivityKind {
  if (!sportType) return "other";
  if (STRENGTH_TYPES.has(sportType)) return "strength";
  if (sportType in CARDIO_TYPES) return "cardio";
  return "other";
}

// Mapea el sport_type a la enum type de cardio_logs. 'other' para tipos de cardio no
// contemplados explícitamente.
export function cardioLogType(
  sportType: string
): "running" | "cycling" | "walking" | "swimming" | "rowing" | "other" {
  return CARDIO_TYPES[sportType] ?? "other";
}

// --- Scoring de asociación con sesiones de fuerza --------------------------

export type WorkoutCandidate = {
  id: string;
  startMs: number;
  endMs: number | null;
};

export type ActivityWindow = {
  startMs: number;
  endMs: number; // start + elapsed
};

// Ventana de búsqueda de candidatos: inicio dentro de ±90 min de la actividad.
export const CANDIDATE_WINDOW_MS = 90 * 60 * 1000;

function overlapFraction(a: ActivityWindow, w: WorkoutCandidate): number {
  if (w.endMs === null) return 0;
  const start = Math.max(a.startMs, w.startMs);
  const end = Math.min(a.endMs, w.endMs);
  const inter = Math.max(0, end - start);
  const shorter = Math.min(a.endMs - a.startMs, w.endMs - w.startMs);
  if (shorter <= 0) return 0;
  return inter / shorter;
}

export function scoreCandidate(
  activity: ActivityWindow,
  sportType: string,
  candidate: WorkoutCandidate
): number {
  let score = 0;

  const startDiffMin = Math.abs(activity.startMs - candidate.startMs) / 60000;
  if (startDiffMin <= 5) score += 50;
  else if (startDiffMin <= 15) score += 35;
  else if (startDiffMin <= 30) score += 20;

  if (candidate.endMs !== null) {
    const actDurMin = (activity.endMs - activity.startMs) / 60000;
    const candDurMin = (candidate.endMs - candidate.startMs) / 60000;
    const durDiffMin = Math.abs(actDurMin - candDurMin);
    if (durDiffMin <= 10) score += 25;
    else if (durDiffMin <= 20) score += 15;
  }

  const overlap = overlapFraction(activity, candidate);
  if (overlap >= 0.8) score += 30;
  else if (overlap >= 0.5) score += 15;

  if (STRENGTH_TYPES.has(sportType)) score += 10;

  return score;
}

export type MatchDecision =
  | { kind: "auto"; workoutLogId: string; score: number }
  | { kind: "ambiguous" };

// Autoasocia solo con alta confianza: score >= 70, un único candidato claramente
// superior (>= 15 puntos sobre el segundo). En otro caso queda pendiente (manual).
export function decideMatch(
  activity: ActivityWindow,
  sportType: string,
  candidates: WorkoutCandidate[]
): MatchDecision {
  if (candidates.length === 0) return { kind: "ambiguous" };

  const scored = candidates
    .map((c) => ({ c, score: scoreCandidate(activity, sportType, c) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const runnerUp = scored[1];

  if (best.score < 70) return { kind: "ambiguous" };
  if (runnerUp && best.score - runnerUp.score < 15) return { kind: "ambiguous" };

  return { kind: "auto", workoutLogId: best.c.id, score: best.score };
}
