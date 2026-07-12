import { describe, expect, it } from "vitest";
import { detectFatigue } from "./fatigue";

describe("detectFatigue", () => {
  it("returns not fatigued with fewer than 2 sessions", () => {
    expect(detectFatigue([{ volume: 800, averageRpe: 8 }]).isFatigued).toBe(false);
    expect(detectFatigue([]).isFatigued).toBe(false);
  });

  it("flags fatigue when RPE rises and volume drops", () => {
    const result = detectFatigue([
      { volume: 1000, averageRpe: 7 },
      { volume: 800, averageRpe: 8.5 },
    ]);
    expect(result.isFatigued).toBe(true);
    expect(result.reason).toMatch(/RPE/);
  });

  it("does not flag fatigue when volume increases even if RPE rises", () => {
    const result = detectFatigue([
      { volume: 800, averageRpe: 7 },
      { volume: 900, averageRpe: 8 },
    ]);
    expect(result.isFatigued).toBe(false);
  });

  it("does not flag fatigue when RPE drops even if volume drops", () => {
    const result = detectFatigue([
      { volume: 1000, averageRpe: 8 },
      { volume: 800, averageRpe: 7 },
    ]);
    expect(result.isFatigued).toBe(false);
  });

  it("flags a sustained rising-RPE / falling-volume trend over 4 sessions", () => {
    const result = detectFatigue([
      { volume: 1200, averageRpe: 7 },
      { volume: 1100, averageRpe: 7.5 },
      { volume: 1000, averageRpe: 8 },
      { volume: 900, averageRpe: 8.5 },
    ]);
    expect(result.isFatigued).toBe(true);
    expect(result.reason).toMatch(/4 sesiones/);
  });

  it("is robust to a single bad last session when the overall trend is healthy", () => {
    // The last pair alone (1100->1000 volume down, 7.5->8 RPE up) would look fatigued,
    // but the trend across 4 sessions is not — RPE is falling and volume rising.
    const result = detectFatigue([
      { volume: 800, averageRpe: 9 },
      { volume: 1000, averageRpe: 7 },
      { volume: 1100, averageRpe: 7.5 },
      { volume: 1000, averageRpe: 8 },
    ]);
    expect(result.isFatigued).toBe(false);
  });

  it("handles missing RPE data without throwing", () => {
    const result = detectFatigue([
      { volume: 1000, averageRpe: null },
      { volume: 800, averageRpe: null },
    ]);
    expect(result.isFatigued).toBe(false);
  });
});
