import { describe, expect, it } from "vitest";
import {
  calcularRacha,
  formatKg,
  getLastWorkoutLabel,
  getLocalDateKey,
  getWorkingSets,
  getWorkoutVolume,
  type MetricWorkout,
} from "./dashboardMetrics";

function isoDaysAgo(referenceDate: Date, daysAgo: number, hour = 12) {
  const date = new Date(referenceDate);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

describe("getWorkingSets", () => {
  it("returns an empty array when setLogs is undefined", () => {
    expect(getWorkingSets(undefined)).toEqual([]);
  });

  it("excludes warmup sets", () => {
    const setLogs = [
      { weight: 100, reps: 5, is_warmup: true },
      { weight: 100, reps: 5, is_warmup: false },
    ];
    expect(getWorkingSets(setLogs)).toEqual([{ weight: 100, reps: 5, is_warmup: false }]);
  });
});

describe("getWorkoutVolume", () => {
  it("returns 0 for undefined or empty setLogs", () => {
    expect(getWorkoutVolume(undefined)).toBe(0);
    expect(getWorkoutVolume([])).toBe(0);
  });

  it("excludes warmup sets from the total", () => {
    const setLogs = [
      { weight: 100, reps: 10, is_warmup: true },
      { weight: 50, reps: 10, is_warmup: false },
    ];
    expect(getWorkoutVolume(setLogs)).toBe(500);
  });

  it("treats null weight/reps as 0", () => {
    const setLogs = [{ weight: null, reps: 10, is_warmup: false }];
    expect(getWorkoutVolume(setLogs)).toBe(0);
  });
});

describe("getLocalDateKey", () => {
  it("buckets a string and a Date input to the same local day", () => {
    const iso = "2026-07-07T12:00:00.000Z";
    expect(getLocalDateKey(iso)).toBe(getLocalDateKey(new Date(iso)));
  });

  it("buckets timestamps just before and just after local midnight into different days", () => {
    const beforeMidnight = new Date("2026-07-06T23:59:59.000Z");
    const afterMidnight = new Date("2026-07-07T00:00:01.000Z");
    expect(getLocalDateKey(beforeMidnight)).not.toBe(getLocalDateKey(afterMidnight));
    expect(getLocalDateKey(beforeMidnight)).toBe("2026-07-06");
    expect(getLocalDateKey(afterMidnight)).toBe("2026-07-07");
  });
});

describe("calcularRacha", () => {
  const referenceDate = new Date("2026-07-07T12:00:00.000Z");

  it("counts N consecutive days ending today", () => {
    const workouts: MetricWorkout[] = [0, 1, 2].map((daysAgo) => ({
      id: String(daysAgo),
      start_time: isoDaysAgo(referenceDate, daysAgo),
      end_time: isoDaysAgo(referenceDate, daysAgo),
    }));
    expect(calcularRacha(workouts, referenceDate)).toBe(3);
  });

  it("stops the streak at a gap", () => {
    const workouts: MetricWorkout[] = [0, 1, 3].map((daysAgo) => ({
      id: String(daysAgo),
      start_time: isoDaysAgo(referenceDate, daysAgo),
      end_time: isoDaysAgo(referenceDate, daysAgo),
    }));
    expect(calcularRacha(workouts, referenceDate)).toBe(2);
  });

  it("returns 0 when there is no workout on the reference date, even with a workout yesterday", () => {
    const workouts: MetricWorkout[] = [
      { id: "1", start_time: isoDaysAgo(referenceDate, 1), end_time: isoDaysAgo(referenceDate, 1) },
    ];
    expect(calcularRacha(workouts, referenceDate)).toBe(0);
  });

  it("excludes workouts without an end_time", () => {
    const workouts: MetricWorkout[] = [{ id: "1", start_time: isoDaysAgo(referenceDate, 0), end_time: null }];
    expect(calcularRacha(workouts, referenceDate)).toBe(0);
  });
});

describe("getLastWorkoutLabel", () => {
  it("returns the empty-state label for an empty list", () => {
    expect(getLastWorkoutLabel([])).toBe("Sin registros");
  });

  it("formats the first workout's start_time", () => {
    const workouts: MetricWorkout[] = [{ id: "1", start_time: "2026-07-07T12:00:00.000Z", end_time: null }];
    expect(getLastWorkoutLabel(workouts)).toBe(new Date(workouts[0].start_time).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }));
  });
});

describe("formatKg", () => {
  it("rounds before formatting", () => {
    expect(formatKg(1234.5)).toBe(new Intl.NumberFormat("es-CL").format(1235));
  });
});
