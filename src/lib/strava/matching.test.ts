import { describe, expect, it } from "vitest";
import {
  classifyActivity,
  cardioLogType,
  decideMatch,
  scoreCandidate,
  type WorkoutCandidate,
} from "./matching";

const MIN = 60_000;

describe("classifyActivity", () => {
  it("classifies strength types", () => {
    expect(classifyActivity("WeightTraining")).toBe("strength");
    expect(classifyActivity("Crossfit")).toBe("strength");
  });
  it("classifies cardio types", () => {
    expect(classifyActivity("Run")).toBe("cardio");
    expect(classifyActivity("Ride")).toBe("cardio");
  });
  it("falls back to other", () => {
    expect(classifyActivity("Yoga")).toBe("other");
    expect(classifyActivity(null)).toBe("other");
  });
});

describe("cardioLogType", () => {
  it("maps to cardio_logs enum", () => {
    expect(cardioLogType("TrailRun")).toBe("running");
    expect(cardioLogType("VirtualRide")).toBe("cycling");
    expect(cardioLogType("Kayaking")).toBe("other");
  });
});

describe("scoreCandidate", () => {
  const start = 1_000_000_000_000;
  const activity = { startMs: start, endMs: start + 60 * MIN };

  it("scores a near-perfect strength match high", () => {
    const cand: WorkoutCandidate = { id: "w1", startMs: start + 2 * MIN, endMs: start + 58 * MIN };
    // inicio <=5 (+50), duración diff <=10 (+25), solape alto (+30), strength (+10) = 115
    expect(scoreCandidate(activity, "WeightTraining", cand)).toBeGreaterThanOrEqual(100);
  });

  it("scores a far-off candidate low", () => {
    const cand: WorkoutCandidate = { id: "w2", startMs: start + 80 * MIN, endMs: start + 90 * MIN };
    expect(scoreCandidate(activity, "WeightTraining", cand)).toBeLessThan(40);
  });
});

describe("decideMatch", () => {
  const start = 1_000_000_000_000;
  const activity = { startMs: start, endMs: start + 60 * MIN };

  it("auto-matches a single strong candidate", () => {
    const cands: WorkoutCandidate[] = [{ id: "w1", startMs: start + 1 * MIN, endMs: start + 59 * MIN }];
    const d = decideMatch(activity, "WeightTraining", cands);
    expect(d.kind).toBe("auto");
    if (d.kind === "auto") expect(d.workoutLogId).toBe("w1");
  });

  it("stays ambiguous when two candidates are close", () => {
    const cands: WorkoutCandidate[] = [
      { id: "w1", startMs: start + 1 * MIN, endMs: start + 59 * MIN },
      { id: "w2", startMs: start + 2 * MIN, endMs: start + 58 * MIN },
    ];
    expect(decideMatch(activity, "WeightTraining", cands).kind).toBe("ambiguous");
  });

  it("stays ambiguous with no candidates", () => {
    expect(decideMatch(activity, "WeightTraining", []).kind).toBe("ambiguous");
  });

  it("stays ambiguous when the best score is below threshold", () => {
    const cands: WorkoutCandidate[] = [{ id: "w1", startMs: start + 40 * MIN, endMs: start + 45 * MIN }];
    expect(decideMatch(activity, "WeightTraining", cands).kind).toBe("ambiguous");
  });
});
