// Deterministic readiness-to-guidance rules (ROADMAP.md, Fase vNext 3). Pure and
// testable so the adaptation logic doesn't end up buried inside the workout page
// component, same reasoning as progression.ts (Fase vNext 2).
export type ReadinessInput = {
  energy: number; // 1-5
  sleepQuality: number; // 1-5
  jointPain: boolean;
  availableMinutes: number | null;
  notes?: string;
};

export type ReadinessGuidance = {
  warnings: string[];
  deprioritizeAccessories: boolean;
};

const LOW_ENERGY_THRESHOLD = 2;
const LOW_SLEEP_THRESHOLD = 2;
const LOW_TIME_MINUTES = 30;

// Free-text safety net: not a medical triage system, just a cheap prompt to stop
// and think before pushing through a session when the user's own note hints at
// something more serious than normal training fatigue.
const RISK_KEYWORDS = [
  "dolor agudo",
  "dolor en el pecho",
  "dolor de pecho",
  "mareo",
  "pérdida de fuerza",
  "perdida de fuerza",
  "postoperatorio",
  "lesión reciente",
  "lesion reciente",
];

export function containsRiskSignal(notes: string): boolean {
  const normalized = notes.toLowerCase();
  return RISK_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

export function getReadinessGuidance(input: ReadinessInput): ReadinessGuidance {
  const warnings: string[] = [];

  if (input.energy <= LOW_ENERGY_THRESHOLD && input.sleepQuality <= LOW_SLEEP_THRESHOLD) {
    warnings.push("Energía y sueño bajos hoy: reduce el volumen ~20-30% y evita llegar al fallo.");
  }

  if (input.jointPain) {
    warnings.push('Marcaste dolor articular: evita ejercicios que carguen esa zona — usa "Sustituir" si hace falta.');
  }

  const deprioritizeAccessories = input.availableMinutes !== null && input.availableMinutes <= LOW_TIME_MINUTES;
  if (deprioritizeAccessories) {
    warnings.push("Tienes poco tiempo: prioriza los ejercicios principales, los accesorios/aislamiento son opcionales hoy.");
  }

  if (input.notes && containsRiskSignal(input.notes)) {
    warnings.push("Tu nota menciona una posible señal de alerta. No fuerces el entrenamiento — considera consultar a un profesional.");
  }

  return { warnings, deprioritizeAccessories };
}
