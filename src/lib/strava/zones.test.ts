import { describe, expect, it } from "vitest";
import { minHeartRate, timePerZone, toSamples } from "./zones";
import type { StravaStreamSet } from "./types";

describe("toSamples", () => {
  it("pairs parallel time/heartrate streams", () => {
    const streams: StravaStreamSet = {
      time: { data: [0, 5, 10] },
      heartrate: { data: [80, 90, 100] },
    };
    expect(toSamples(streams)).toEqual([
      { second: 0, bpm: 80 },
      { second: 5, bpm: 90 },
      { second: 10, bpm: 100 },
    ]);
  });

  it("truncates to the shorter stream (Strava may differ)", () => {
    const streams: StravaStreamSet = {
      time: { data: [0, 5, 10, 15] },
      heartrate: { data: [80, 90] },
    };
    expect(toSamples(streams)).toHaveLength(2);
  });

  it("returns empty when a stream is missing", () => {
    expect(toSamples({ time: { data: [0, 5] } })).toEqual([]);
  });
});

describe("minHeartRate", () => {
  it("finds the minimum positive bpm", () => {
    expect(minHeartRate([{ second: 0, bpm: 120 }, { second: 5, bpm: 95 }])).toBe(95);
  });
  it("returns null for no samples", () => {
    expect(minHeartRate([])).toBeNull();
  });
});

describe("timePerZone", () => {
  it("assigns interval time to the first sample's zone", () => {
    // maxHR 200: 100 bpm = 0.5 -> Z1; 150 = 0.75 -> Z3; 190 = 0.95 -> Z5
    const samples = [
      { second: 0, bpm: 100 },
      { second: 10, bpm: 150 },
      { second: 20, bpm: 190 },
    ];
    const z = timePerZone(samples, 200);
    expect(z.zone1Seconds).toBe(10); // [0,10) at 100 bpm
    expect(z.zone3Seconds).toBe(10); // [10,20) at 150 bpm
    // la última muestra no aporta intervalo
    expect(z.zone5Seconds).toBe(0);
  });

  it("caps long data gaps", () => {
    const samples = [
      { second: 0, bpm: 100 },
      { second: 500, bpm: 150 },
    ];
    const z = timePerZone(samples, 200, 30);
    expect(z.zone1Seconds).toBe(30); // gap de 500s recortado a 30
  });

  it("returns zeros without a max heart rate", () => {
    const z = timePerZone([{ second: 0, bpm: 100 }, { second: 10, bpm: 120 }], null);
    expect(z.zone1Seconds).toBe(0);
  });
});
