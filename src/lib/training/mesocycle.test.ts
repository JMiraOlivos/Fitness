import { describe, expect, it } from "vitest";
import { classifyMesocyclePhase, shouldSuggestAdaptiveDeload } from "./mesocycle";

describe("classifyMesocyclePhase", () => {
  it("classifies a 4-week block with deload every 4 weeks", () => {
    expect(classifyMesocyclePhase(1, 8, 4)).toBe("base");
    expect(classifyMesocyclePhase(2, 8, 4)).toBe("acumulacion");
    expect(classifyMesocyclePhase(3, 8, 4)).toBe("intensificacion");
    expect(classifyMesocyclePhase(4, 8, 4)).toBe("deload");
  });

  it("classifies the second block the same way", () => {
    expect(classifyMesocyclePhase(5, 8, 4)).toBe("base");
    expect(classifyMesocyclePhase(6, 8, 4)).toBe("acumulacion");
    expect(classifyMesocyclePhase(7, 8, 4)).toBe("intensificacion");
  });

  it("treats the final week of the program as test, even overriding deload cadence", () => {
    expect(classifyMesocyclePhase(8, 8, 4)).toBe("deload");
    expect(classifyMesocyclePhase(6, 6, 3)).toBe("deload");
    expect(classifyMesocyclePhase(7, 7, 4)).toBe("test");
  });

  it("classifies a program with no deload cadence using the whole duration as one block", () => {
    expect(classifyMesocyclePhase(1, 9, null)).toBe("base");
    expect(classifyMesocyclePhase(4, 9, null)).toBe("acumulacion");
    expect(classifyMesocyclePhase(7, 9, null)).toBe("intensificacion");
    expect(classifyMesocyclePhase(9, 9, null)).toBe("test");
  });
});

describe("shouldSuggestAdaptiveDeload", () => {
  it("does not suggest deload when everything is fine", () => {
    const result = shouldSuggestAdaptiveDeload({ fatiguedExerciseCount: 0, adherence: { planned: 4, completed: 4 } });
    expect(result.suggest).toBe(false);
  });

  it("suggests deload when 2 or more exercises show fatigue", () => {
    const result = shouldSuggestAdaptiveDeload({ fatiguedExerciseCount: 2, adherence: null });
    expect(result.suggest).toBe(true);
    expect(result.reason).toMatch(/fatiga/);
  });

  it("does not suggest deload for a single fatigued exercise", () => {
    const result = shouldSuggestAdaptiveDeload({ fatiguedExerciseCount: 1, adherence: null });
    expect(result.suggest).toBe(false);
  });

  it("suggests deload when adherence is below half the plan", () => {
    const result = shouldSuggestAdaptiveDeload({ fatiguedExerciseCount: 0, adherence: { planned: 4, completed: 1 } });
    expect(result.suggest).toBe(true);
    expect(result.reason).toMatch(/1\/4/);
  });

  it("does not suggest deload when adherence is at or above half the plan", () => {
    const result = shouldSuggestAdaptiveDeload({ fatiguedExerciseCount: 0, adherence: { planned: 4, completed: 2 } });
    expect(result.suggest).toBe(false);
  });
});
