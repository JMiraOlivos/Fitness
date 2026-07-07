// Deterministic strength/hypertrophy progression rules. This replaces the RPE-only
// heuristic that used to live inline in the workout page (see ROADMAP.md, Fase
// vNext 2): same inputs, but now testable and aware of exercise priority and
// deload weeks. Gemini can still explain *why* in prose, but the number comes
// from here, not from the model.
export type ExercisePriority = "principal" | "accesorio" | "aislamiento" | "correctivo";

export type ProgressionLastSession = {
  maxWeight: number;
  lastReps: number;
  averageRpe: number | null;
};

export type ProgressionInput = {
  lastSession: ProgressionLastSession | null;
  priority?: ExercisePriority;
  isDeloadWeek?: boolean;
};

export type ProgressionAction = "increase_weight" | "increase_reps" | "maintain" | "reduce_load";

export type ProgressionRecommendation = {
  suggestedWeight: number;
  suggestedReps: number;
  action: ProgressionAction;
  reason: string;
};

const WEIGHT_STEP_KG = 2.5;
const DELOAD_LOAD_MULTIPLIER = 0.9;
const HIGH_RPE_REDUCE_MULTIPLIER = 0.95;

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export function recommendNextSet(input: ProgressionInput): ProgressionRecommendation | null {
  const { lastSession, isDeloadWeek = false } = input;
  const priority = input.priority ?? "principal";

  if (!lastSession) return null;

  const { maxWeight, lastReps, averageRpe } = lastSession;

  if (isDeloadWeek) {
    return {
      suggestedWeight: round(maxWeight * DELOAD_LOAD_MULTIPLIER),
      suggestedReps: lastReps,
      action: "reduce_load",
      reason: "Semana de deload: reduce ~10% la carga y no busques PRs.",
    };
  }

  if (averageRpe === null) {
    return {
      suggestedWeight: maxWeight,
      suggestedReps: lastReps,
      action: "maintain",
      reason: "Sin RPE registrado la última vez. Repite el peso y ajusta reps si puedes.",
    };
  }

  if (averageRpe >= 9.5) {
    return {
      suggestedWeight: round(maxWeight * HIGH_RPE_REDUCE_MULTIPLIER),
      suggestedReps: lastReps,
      action: "reduce_load",
      reason: `RPE ${averageRpe.toFixed(1)} muy alto. Baja ~5% la carga esta vez.`,
    };
  }

  if (priority === "correctivo") {
    return {
      suggestedWeight: maxWeight,
      suggestedReps: lastReps,
      action: "maintain",
      reason: "Ejercicio correctivo: prioriza técnica y rango sobre la carga.",
    };
  }

  if (priority === "aislamiento") {
    if (averageRpe <= 6) {
      return {
        suggestedWeight: round(maxWeight + WEIGHT_STEP_KG),
        suggestedReps: lastReps,
        action: "increase_weight",
        reason: `RPE ${averageRpe.toFixed(1)} bajo. Progresión conservadora: sube ${WEIGHT_STEP_KG} kg.`,
      };
    }

    return {
      suggestedWeight: maxWeight,
      suggestedReps: lastReps,
      action: "maintain",
      reason: "Aislamiento: mantén el peso y enfócate en control y tempo.",
    };
  }

  if (priority === "accesorio") {
    if (averageRpe <= 7) {
      return {
        suggestedWeight: maxWeight,
        suggestedReps: lastReps + 1,
        action: "increase_reps",
        reason: `RPE ${averageRpe.toFixed(1)}. Progresa reps antes que peso en accesorios.`,
      };
    }

    return {
      suggestedWeight: maxWeight,
      suggestedReps: lastReps,
      action: "maintain",
      reason: `RPE ${averageRpe.toFixed(1)}. Mantén el peso.`,
    };
  }

  // principal
  if (averageRpe <= 7) {
    return {
      suggestedWeight: round(maxWeight + WEIGHT_STEP_KG),
      suggestedReps: lastReps,
      action: "increase_weight",
      reason: `RPE ${averageRpe.toFixed(1)} bajo. Sube ${WEIGHT_STEP_KG} kg.`,
    };
  }

  if (averageRpe >= 9) {
    return {
      suggestedWeight: maxWeight,
      suggestedReps: lastReps,
      action: "maintain",
      reason: `RPE ${averageRpe.toFixed(1)} alto. Mantén el peso.`,
    };
  }

  return {
    suggestedWeight: maxWeight,
    suggestedReps: lastReps + 1,
    action: "increase_reps",
    reason: `RPE ${averageRpe.toFixed(1)}. Mantén el peso, busca más reps.`,
  };
}
