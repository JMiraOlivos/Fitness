// Epley estimate. Accuracy degrades fast past ~12 reps, so callers should treat
// a null result as "not available" rather than falling back to a guess.
export const MAX_RELIABLE_REPS_FOR_ONE_REP_MAX = 12;

export function estimateOneRepMax(weight: number, reps: number): number | null {
  if (!weight || !reps) return null;
  if (reps > MAX_RELIABLE_REPS_FOR_ONE_REP_MAX) return null;

  return weight * (1 + reps / 30);
}
