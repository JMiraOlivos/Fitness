// vNext++ U15 (ROADMAP.md): balance por patrón de movimiento. Un desbalance
// empuje/tracción o superior/inferior es un chequeo clásico de programación que
// previene lesiones y estancamientos. Se clasifica por grupo muscular (dato siempre
// presente en set_logs -> exercises) en vez de movement_pattern (que la mayoría de
// ejercicios no tiene curado todavía), para que funcione con los datos reales.

export type MovementCategory = "empuje" | "traccion" | "inferior" | "core" | "otro";

const MUSCLE_TO_CATEGORY: Record<string, MovementCategory> = {
  Pecho: "empuje",
  Hombro: "empuje",
  Tríceps: "empuje",
  Espalda: "traccion",
  Bíceps: "traccion",
  Antebrazo: "traccion",
  Trapecio: "traccion",
  Cuádriceps: "inferior",
  Isquiotibiales: "inferior",
  Glúteo: "inferior",
  Pantorrilla: "inferior",
  Core: "core",
};

export function classifyMuscleCategory(muscleGroup: string): MovementCategory {
  return MUSCLE_TO_CATEGORY[muscleGroup] ?? "otro";
}

export type BalanceInput = { muscleGroup: string; sets: number };

export type BalanceRatio = {
  label: string;
  a: { label: string; sets: number };
  b: { label: string; sets: number };
  // Cociente del lado mayor sobre el menor (>= 1). null si falta un lado.
  ratio: number | null;
  warning: string | null;
};

const IMBALANCE_THRESHOLD = 1.5; // > 50% más de un lado que del otro se marca.

function buildRatio(
  label: string,
  aLabel: string,
  aSets: number,
  bLabel: string,
  bSets: number
): BalanceRatio {
  const ratio = aSets > 0 && bSets > 0 ? Math.max(aSets, bSets) / Math.min(aSets, bSets) : null;

  let warning: string | null = null;
  if (ratio !== null && ratio >= IMBALANCE_THRESHOLD) {
    const dominant = aSets > bSets ? aLabel : bLabel;
    const weaker = aSets > bSets ? bLabel : aLabel;
    warning = `Desbalance ${label.toLowerCase()}: bastante más ${dominant} que ${weaker}. Considera equilibrar el volumen.`;
  }

  return {
    label,
    a: { label: aLabel, sets: aSets },
    b: { label: bLabel, sets: bSets },
    ratio,
    warning,
  };
}

// Agrega series por categoría y arma los dos balances clásicos: empuje vs tracción
// (equilibrio del tren superior) y superior vs inferior.
export function analyzeMovementBalance(inputs: BalanceInput[]): {
  byCategory: Record<MovementCategory, number>;
  ratios: BalanceRatio[];
  warnings: string[];
} {
  const byCategory: Record<MovementCategory, number> = {
    empuje: 0,
    traccion: 0,
    inferior: 0,
    core: 0,
    otro: 0,
  };

  for (const input of inputs) {
    byCategory[classifyMuscleCategory(input.muscleGroup)] += input.sets;
  }

  const upper = byCategory.empuje + byCategory.traccion;

  const ratios = [
    buildRatio("empuje / tracción", "empuje", byCategory.empuje, "tracción", byCategory.traccion),
    buildRatio("superior / inferior", "tren superior", upper, "tren inferior", byCategory.inferior),
  ];

  const warnings = ratios.map((ratio) => ratio.warning).filter((warning): warning is string => warning !== null);

  return { byCategory, ratios, warnings };
}
