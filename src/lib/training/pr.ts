import { estimateOneRepMax } from "@/lib/oneRepMax";

export type PrMetric = "weight" | "reps" | "volume" | "one_rep_max";

export type PersonalRecord = {
  metric: PrMetric;
  value: number;
  previousBest: number | null;
};

const METRIC_LABELS: Record<PrMetric, string> = {
  weight: "Peso máximo",
  reps: "Repeticiones",
  volume: "Volumen",
  one_rep_max: "1RM estimado",
};

export function prLabel(record: PersonalRecord): string {
  return `${METRIC_LABELS[record.metric]}: ${formatPrValue(record.metric, record.value)}`;
}

function formatPrValue(metric: PrMetric, value: number): string {
  switch (metric) {
    case "weight":
    case "one_rep_max":
      return `${Math.round(value)} kg`;
    case "reps":
      return `${value}`;
    case "volume":
      return `${Math.round(value)} kg`;
  }
}

// Compares the current set (weight, reps, volume in this session so far)
// against the historical best values for the exercise to detect if any
// metric was just broken. Returns an array of PRs detected.
export function detectPRs(
  exerciseId: string,
  weight: number,
  reps: number,
  sessionVolume: number,
  historicalBests: Record<string, { maxWeight: number; maxReps: number; maxVolume: number; maxOneRepMax: number | null }>
): PersonalRecord[] {
  const bests = historicalBests[exerciseId];
  if (!bests) {
    // First time exercising — everything is a PR
    const oneRepMax = estimateOneRepMax(weight, reps);
    const prs: PersonalRecord[] = [
      { metric: "weight", value: weight, previousBest: null },
      { metric: "reps", value: reps, previousBest: null },
      { metric: "volume", value: sessionVolume, previousBest: null },
    ];
    if (oneRepMax !== null) {
      prs.push({ metric: "one_rep_max", value: oneRepMax, previousBest: null });
    }
    return prs;
  }

  const prs: PersonalRecord[] = [];
  const oneRepMax = estimateOneRepMax(weight, reps);

  if (weight > bests.maxWeight) {
    prs.push({ metric: "weight", value: weight, previousBest: bests.maxWeight });
  }
  if (reps > bests.maxReps) {
    prs.push({ metric: "reps", value: reps, previousBest: bests.maxReps });
  }
  if (sessionVolume > bests.maxVolume) {
    prs.push({ metric: "volume", value: sessionVolume, previousBest: bests.maxVolume });
  }
  if (oneRepMax !== null && (bests.maxOneRepMax === null || oneRepMax > bests.maxOneRepMax)) {
    prs.push({ metric: "one_rep_max", value: oneRepMax, previousBest: bests.maxOneRepMax });
  }

  return prs;
}

// Fetches historical bests for a set of exercise IDs from the set_logs table.
// Warm-up sets are excluded. Returns a map of exercise_id -> best values.
export type HistoricalBests = {
  maxWeight: number;
  maxReps: number;
  maxVolume: number;
  maxOneRepMax: number | null;
};
