import { describe, expect, it } from "vitest";
import { recommendNextSet } from "./progression";

describe("recommendNextSet", () => {
  it("returns null without a previous session", () => {
    expect(recommendNextSet({ lastSession: null })).toBeNull();
  });

  it("suggests increasing weight for a principal exercise with low RPE", () => {
    const result = recommendNextSet({
      lastSession: { maxWeight: 80, lastReps: 8, averageRpe: 7 },
      priority: "principal",
    });

    expect(result?.action).toBe("increase_weight");
    expect(result?.suggestedWeight).toBe(82.5);
  });

  it("maintains weight for a principal exercise at target RPE", () => {
    const result = recommendNextSet({
      lastSession: { maxWeight: 80, lastReps: 8, averageRpe: 8 },
      priority: "principal",
    });

    expect(result?.action).toBe("increase_reps");
    expect(result?.suggestedWeight).toBe(80);
  });

  it("reduces load when RPE is very high, regardless of priority", () => {
    const result = recommendNextSet({
      lastSession: { maxWeight: 80, lastReps: 8, averageRpe: 9.5 },
      priority: "principal",
    });

    expect(result?.action).toBe("reduce_load");
    expect(result?.suggestedWeight).toBe(76);
  });

  it("never recommends a PR during a deload week", () => {
    const result = recommendNextSet({
      lastSession: { maxWeight: 80, lastReps: 8, averageRpe: 6 },
      priority: "principal",
      isDeloadWeek: true,
    });

    expect(result?.action).toBe("reduce_load");
    expect(result?.suggestedWeight).toBe(72);
  });

  it("progresses accessory exercises through reps before weight", () => {
    const result = recommendNextSet({
      lastSession: { maxWeight: 20, lastReps: 12, averageRpe: 7 },
      priority: "accesorio",
    });

    expect(result?.action).toBe("increase_reps");
    expect(result?.suggestedReps).toBe(13);
    expect(result?.suggestedWeight).toBe(20);
  });

  it("is more conservative with isolation exercises than principal ones", () => {
    const isolation = recommendNextSet({
      lastSession: { maxWeight: 10, lastReps: 15, averageRpe: 7 },
      priority: "aislamiento",
    });
    const principal = recommendNextSet({
      lastSession: { maxWeight: 10, lastReps: 15, averageRpe: 7 },
      priority: "principal",
    });

    expect(isolation?.action).toBe("maintain");
    expect(principal?.action).toBe("increase_weight");
  });

  it("keeps corrective exercises focused on technique, not load", () => {
    const result = recommendNextSet({
      lastSession: { maxWeight: 5, lastReps: 10, averageRpe: 5 },
      priority: "correctivo",
    });

    expect(result?.action).toBe("maintain");
  });

  it("falls back to maintain when there is no RPE on record", () => {
    const result = recommendNextSet({
      lastSession: { maxWeight: 80, lastReps: 8, averageRpe: null },
      priority: "principal",
    });

    expect(result?.action).toBe("maintain");
    expect(result?.suggestedWeight).toBe(80);
  });
});
