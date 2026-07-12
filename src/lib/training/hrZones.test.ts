import { describe, expect, it } from "vitest";
import { classifyHeartRateZone, estimateMaxHeartRate } from "./hrZones";

describe("estimateMaxHeartRate", () => {
  it("prefers a measured override", () => {
    expect(estimateMaxHeartRate({ overrideMax: 190, birthYear: 1990, currentYear: 2026 })).toBe(190);
  });

  it("estimates from age with the Tanaka formula", () => {
    // age 36 -> 208 - 0.7*36 = 182.8 -> 183
    expect(estimateMaxHeartRate({ birthYear: 1990, currentYear: 2026 })).toBe(183);
  });

  it("returns null without override or birth year", () => {
    expect(estimateMaxHeartRate({ currentYear: 2026 })).toBeNull();
  });

  it("returns null for an implausible age", () => {
    expect(estimateMaxHeartRate({ birthYear: 1850, currentYear: 2026 })).toBeNull();
  });
});

describe("classifyHeartRateZone", () => {
  it("returns null when data is missing", () => {
    expect(classifyHeartRateZone(null, 190)).toBeNull();
    expect(classifyHeartRateZone(150, null)).toBeNull();
  });

  it("classifies a mid-range heart rate into an aerobic zone", () => {
    // 130/190 = 0.684 -> Z2 (0.6-0.7)
    expect(classifyHeartRateZone(130, 190)?.zone).toBe(2);
  });

  it("classifies a near-max heart rate into Z5", () => {
    // 185/190 = 0.973 -> Z5
    expect(classifyHeartRateZone(185, 190)?.zone).toBe(5);
  });

  it("floors a very low heart rate into Z1", () => {
    // 80/190 = 0.42 -> below Z1 min -> Z1
    expect(classifyHeartRateZone(80, 190)?.zone).toBe(1);
  });

  it("returns null for an out-of-range heart rate", () => {
    expect(classifyHeartRateZone(300, 190)).toBeNull();
  });
});
