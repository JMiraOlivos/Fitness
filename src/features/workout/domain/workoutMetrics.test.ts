import { describe, expect, it } from "vitest";
import { buildSuggestion, formatRestTime, getAverageRpe, getVolume } from "./workoutMetrics";
import type { HistorySetRow, LocalSetLog } from "../types";

function setLog(overrides: Partial<LocalSetLog> = {}): LocalSetLog {
  return { id: "1", set_number: 1, weight: 80, reps: 8, rpe: 8, is_warmup: false, ...overrides };
}

function historyRow(overrides: Partial<HistorySetRow> = {}): HistorySetRow {
  return {
    exercise_id: "ex-1",
    workout_log_id: "log-1",
    weight: 80,
    reps: 8,
    rpe: 7,
    is_warmup: false,
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

describe("getVolume", () => {
  it("excludes warmup sets", () => {
    const logs = [setLog({ weight: 20, reps: 10, is_warmup: true }), setLog({ weight: 80, reps: 8 })];
    expect(getVolume(logs)).toBe(80 * 8);
  });
});

describe("getAverageRpe", () => {
  it("returns null when there is no RPE on record", () => {
    expect(getAverageRpe([setLog({ rpe: null })])).toBeNull();
  });

  it("averages only working sets with an RPE", () => {
    const logs = [setLog({ rpe: 6, is_warmup: true }), setLog({ rpe: 8 }), setLog({ rpe: 10 })];
    expect(getAverageRpe(logs)).toBe(9);
  });
});

describe("formatRestTime", () => {
  it("formats seconds as m:ss", () => {
    expect(formatRestTime(90)).toBe("1:30");
    expect(formatRestTime(5)).toBe("0:05");
  });
});

describe("buildSuggestion", () => {
  it("returns null without any working sets", () => {
    expect(buildSuggestion([historyRow({ is_warmup: true })], false, null)).toBeNull();
  });

  it("builds a suggestion from the last session's rows", () => {
    const suggestion = buildSuggestion([historyRow({ weight: 80, reps: 8, rpe: 7 })], false, "principal");
    expect(suggestion?.lastWeight).toBe(80);
    expect(suggestion?.suggestedWeight).toBe(82.5);
  });

  it("caps the suggestion during a deload week", () => {
    const suggestion = buildSuggestion([historyRow({ weight: 80, reps: 8, rpe: 6 })], true, "principal");
    expect(suggestion?.suggestedWeight).toBe(72);
  });
});
