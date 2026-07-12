// Deterministic multi-session fatigue signal per exercise (ROADMAP.md, Fase vNext 7,
// refinado en vNext++ U14). En vez de comparar solo las 2 últimas sesiones (frágil
// ante una sola sesión mala = falso positivo), mira la *tendencia* sobre las últimas
// hasta 4 sesiones: fatiga cuando el RPE viene subiendo mientras el volumen viene
// bajando de forma sostenida. Una pendiente por mínimos cuadrados suaviza un outlier
// puntual sin dejar de detectar una deriva real.
export type SessionSummary = {
  volume: number;
  averageRpe: number | null;
};

export type FatigueSignal = {
  isFatigued: boolean;
  reason: string | null;
};

const FATIGUE_WINDOW = 4;

// Least-squares slope of `values` against their index (0..n-1). Positive = trending
// up, negative = trending down. Returns 0 for fewer than 2 points.
function slope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  const meanX = (n - 1) / 2;
  const meanY = values.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    numerator += (i - meanX) * (values[i] - meanY);
    denominator += (i - meanX) ** 2;
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

// `sessions` must be ordered oldest -> newest.
export function detectFatigue(sessions: SessionSummary[]): FatigueSignal {
  if (sessions.length < 2) {
    return { isFatigued: false, reason: null };
  }

  const window = sessions.slice(-FATIGUE_WINDOW);

  // Volume trend over the whole window.
  const volumeSlope = slope(window.map((session) => session.volume));

  // RPE trend only over sessions that actually recorded RPE (need >= 2 points to have
  // a trend at all).
  const rpePoints = window
    .filter((session) => session.averageRpe !== null)
    .map((session) => session.averageRpe as number);
  const rpeSlope = rpePoints.length >= 2 ? slope(rpePoints) : 0;
  const hasRpeTrend = rpePoints.length >= 2;

  if (hasRpeTrend && rpeSlope > 0 && volumeSlope < 0) {
    const label = window.length >= 3 ? `las últimas ${window.length} sesiones` : "las últimas 2 sesiones";
    return { isFatigued: true, reason: `RPE subiendo y volumen bajando en ${label}.` };
  }

  return { isFatigued: false, reason: null };
}
