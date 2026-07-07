// Mesocycle phase classification and adaptive-deload suggestion (ROADMAP.md,
// Fase vNext 8 — resto). Deliberately derived, not persisted: same rationale as
// `is_deload_week` in 20260710_add_mesociclos.sql ("no tener un segundo estado
// que pueda desincronizarse") — phase is a pure function of week/duration/cadence.
export const MESOCYCLE_PHASES = ["base", "acumulacion", "intensificacion", "deload", "test"] as const;

export type MesocyclePhase = (typeof MESOCYCLE_PHASES)[number];

export type MesocyclePhaseTarget = {
  label: string;
  volumeMultiplier: number;
  intensityMultiplier: number;
  instruction: string;
};

export const MESOCYCLE_PHASE_TARGETS: Record<MesocyclePhase, MesocyclePhaseTarget> = {
  base: {
    label: "Base",
    volumeMultiplier: 0.85,
    intensityMultiplier: 0.85,
    instruction: "Fase base: prioriza técnica y acumula volumen moderado antes de subir intensidad.",
  },
  acumulacion: {
    label: "Acumulación",
    volumeMultiplier: 1.0,
    intensityMultiplier: 0.9,
    instruction: "Fase de acumulación: sube el volumen (series) manteniendo intensidad moderada.",
  },
  intensificacion: {
    label: "Intensificación",
    volumeMultiplier: 0.95,
    intensityMultiplier: 1.05,
    instruction: "Fase de intensificación: baja levemente el volumen y sube la intensidad/carga.",
  },
  deload: {
    label: "Deload",
    volumeMultiplier: 0.55,
    intensityMultiplier: 0.85,
    instruction: "Semana de descarga: reduce el volumen (series) 40-50% y baja la intensidad sugerida, sin buscar PRs.",
  },
  test: {
    label: "Test",
    volumeMultiplier: 0.6,
    intensityMultiplier: 1.1,
    instruction: "Semana de test/consolidación: reduce el volumen y prioriza series de calidad para evaluar progreso.",
  },
};

// weekNumber is 1-indexed. deloadEveryNWeeks null means the program has no
// scheduled deload cadence.
export function classifyMesocyclePhase(weekNumber: number, durationWeeks: number, deloadEveryNWeeks: number | null): MesocyclePhase {
  if (deloadEveryNWeeks != null && weekNumber % deloadEveryNWeeks === 0) {
    return "deload";
  }

  if (weekNumber >= durationWeeks) {
    return "test";
  }

  const blockLength = deloadEveryNWeeks ?? durationWeeks;
  const nonDeloadWeeksInBlock = deloadEveryNWeeks != null ? blockLength - 1 : blockLength;
  const positionInBlock = deloadEveryNWeeks != null ? weekNumber % deloadEveryNWeeks : weekNumber;
  const thirdSize = nonDeloadWeeksInBlock / 3;

  if (positionInBlock <= thirdSize) return "base";
  if (positionInBlock <= thirdSize * 2) return "acumulacion";
  return "intensificacion";
}

export type AdaptiveDeloadInput = {
  fatiguedExerciseCount: number;
  adherence: { planned: number; completed: number } | null;
};

export type AdaptiveDeloadSuggestion = {
  suggest: boolean;
  reason: string | null;
};

const FATIGUE_THRESHOLD = 2;
const LOW_ADHERENCE_RATIO = 0.5;

// Suggests treating the upcoming week as a deload even off cadence, based on real
// signals from Fase vNext 7 (detectFatigue / adherence) rather than only the fixed
// N-week schedule. Never auto-applies — the caller decides whether to force it.
export function shouldSuggestAdaptiveDeload(input: AdaptiveDeloadInput): AdaptiveDeloadSuggestion {
  if (input.fatiguedExerciseCount >= FATIGUE_THRESHOLD) {
    return {
      suggest: true,
      reason: `${input.fatiguedExerciseCount} ejercicios muestran señales de fatiga (RPE sube y volumen baja).`,
    };
  }

  if (input.adherence && input.adherence.planned > 0 && input.adherence.completed / input.adherence.planned < LOW_ADHERENCE_RATIO) {
    return {
      suggest: true,
      reason: `Solo completaste ${input.adherence.completed}/${input.adherence.planned} entrenamientos la semana pasada.`,
    };
  }

  return { suggest: false, reason: null };
}
