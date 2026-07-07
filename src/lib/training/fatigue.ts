// Deterministic multi-session fatigue signal per exercise (ROADMAP.md, Fase vNext 7).
// Deliberately simple: RPE trending up while volume trends down across the last two
// sessions is the one pattern that's unambiguous without more historical context.
export type SessionSummary = {
  volume: number;
  averageRpe: number | null;
};

export type FatigueSignal = {
  isFatigued: boolean;
  reason: string | null;
};

// `sessions` must be ordered oldest -> newest.
export function detectFatigue(sessions: SessionSummary[]): FatigueSignal {
  if (sessions.length < 2) {
    return { isFatigued: false, reason: null };
  }

  const previous = sessions[sessions.length - 2];
  const latest = sessions[sessions.length - 1];

  const rpeIncreased = previous.averageRpe !== null && latest.averageRpe !== null && latest.averageRpe > previous.averageRpe;
  const volumeDecreased = latest.volume < previous.volume;

  if (rpeIncreased && volumeDecreased) {
    return { isFatigued: true, reason: "RPE subiendo y volumen bajando en las últimas 2 sesiones." };
  }

  return { isFatigued: false, reason: null };
}
