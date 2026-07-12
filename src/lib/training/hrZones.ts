// vNext++ U10 (ROADMAP.md): zonas de frecuencia cardíaca para prescribir/leer cardio
// en serio, no solo una FC media suelta. FC máxima medida (override en perfil) o
// estimada por edad con la fórmula de Tanaka (208 - 0.7*edad), más precisa que la
// clásica 220-edad. Todo puro y testeable; la UI de cardio deriva la zona en cliente.

export type HeartRateZone = {
  zone: 1 | 2 | 3 | 4 | 5;
  label: string;
  description: string;
  // Rango como fracción de la FC máx [min, max).
  minFraction: number;
  maxFraction: number;
};

export const HEART_RATE_ZONES: HeartRateZone[] = [
  { zone: 1, label: "Z1 · Recuperación", description: "Muy suave, calentamiento y recuperación activa", minFraction: 0.5, maxFraction: 0.6 },
  { zone: 2, label: "Z2 · Aeróbico", description: "Base aeróbica, conversacional, quema de grasa", minFraction: 0.6, maxFraction: 0.7 },
  { zone: 3, label: "Z3 · Tempo", description: "Aeróbico exigente, ritmo sostenido", minFraction: 0.7, maxFraction: 0.8 },
  { zone: 4, label: "Z4 · Umbral", description: "Umbral anaeróbico, duro de sostener", minFraction: 0.8, maxFraction: 0.9 },
  { zone: 5, label: "Z5 · VO2 máx", description: "Máximo esfuerzo, intervalos cortos", minFraction: 0.9, maxFraction: 1.01 },
];

// Tanaka et al. (2001): FC máx = 208 - 0.7 * edad. Devuelve el override medido si está
// presente. `null` si no hay ni override ni año de nacimiento con el que estimarla.
export function estimateMaxHeartRate(params: {
  birthYear?: number | null;
  overrideMax?: number | null;
  currentYear: number;
}): number | null {
  if (params.overrideMax && params.overrideMax > 0) return params.overrideMax;
  if (!params.birthYear) return null;

  const age = params.currentYear - params.birthYear;
  if (age < 5 || age > 120) return null;

  return Math.round(208 - 0.7 * age);
}

// Clasifica una FC absoluta en su zona relativa a la FC máx. Devuelve null si faltan
// datos o la FC está fuera de un rango plausible.
export function classifyHeartRateZone(heartRate: number | null | undefined, maxHeartRate: number | null | undefined): HeartRateZone | null {
  if (!heartRate || !maxHeartRate || maxHeartRate <= 0) return null;
  if (heartRate < 30 || heartRate > 240) return null;

  const fraction = heartRate / maxHeartRate;

  // Por debajo de Z1 (muy baja) la asignamos a Z1; por encima, a Z5.
  if (fraction < HEART_RATE_ZONES[0].minFraction) return HEART_RATE_ZONES[0];

  for (const zone of HEART_RATE_ZONES) {
    if (fraction >= zone.minFraction && fraction < zone.maxFraction) return zone;
  }

  return HEART_RATE_ZONES[HEART_RATE_ZONES.length - 1];
}
