import { describe, expect, it } from "vitest";
import { containsRiskSignal, getReadinessGuidance } from "./readiness";

describe("getReadinessGuidance", () => {
  it("returns no warnings when readiness is good and time is plentiful", () => {
    const result = getReadinessGuidance({ energy: 4, sleepQuality: 4, jointPain: false, availableMinutes: 60 });
    expect(result.warnings).toHaveLength(0);
    expect(result.deprioritizeAccessories).toBe(false);
  });

  it("warns to reduce volume when energy and sleep are both low", () => {
    const result = getReadinessGuidance({ energy: 2, sleepQuality: 1, jointPain: false, availableMinutes: null });
    expect(result.warnings).toContainEqual(expect.stringMatching(/reduce el volumen/i));
  });

  it("does not warn about fatigue when only one of energy/sleep is low", () => {
    const result = getReadinessGuidance({ energy: 2, sleepQuality: 4, jointPain: false, availableMinutes: null });
    expect(result.warnings.some((w) => /reduce el volumen/i.test(w))).toBe(false);
  });

  it("warns about joint pain", () => {
    const result = getReadinessGuidance({ energy: 4, sleepQuality: 4, jointPain: true, availableMinutes: null });
    expect(result.warnings).toContainEqual(expect.stringMatching(/dolor articular/i));
  });

  it("deprioritizes accessories and warns when available time is low", () => {
    const result = getReadinessGuidance({ energy: 4, sleepQuality: 4, jointPain: false, availableMinutes: 30 });
    expect(result.deprioritizeAccessories).toBe(true);
    expect(result.warnings).toContainEqual(expect.stringMatching(/poco tiempo/i));
  });

  it("does not deprioritize accessories with plenty of time", () => {
    const result = getReadinessGuidance({ energy: 4, sleepQuality: 4, jointPain: false, availableMinutes: 75 });
    expect(result.deprioritizeAccessories).toBe(false);
  });

  it("flags a risk signal in free-text notes", () => {
    const result = getReadinessGuidance({
      energy: 4,
      sleepQuality: 4,
      jointPain: false,
      availableMinutes: null,
      notes: "Sentí un mareo fuerte ayer",
    });
    expect(result.warnings).toContainEqual(expect.stringMatching(/consultar a un profesional/i));
  });

  it("does not flag normal training notes as risk", () => {
    const result = getReadinessGuidance({
      energy: 4,
      sleepQuality: 4,
      jointPain: false,
      availableMinutes: null,
      notes: "Un poco cansado pero bien",
    });
    expect(result.warnings.some((w) => /consultar a un profesional/i.test(w))).toBe(false);
  });
});

describe("containsRiskSignal", () => {
  it("matches case-insensitively", () => {
    expect(containsRiskSignal("Tuve MAREO esta mañana")).toBe(true);
  });

  it("returns false for unrelated text", () => {
    expect(containsRiskSignal("Todo normal, buena sesión")).toBe(false);
  });
});
