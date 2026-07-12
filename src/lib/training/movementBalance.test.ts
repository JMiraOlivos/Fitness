import { describe, expect, it } from "vitest";
import { analyzeMovementBalance, classifyMuscleCategory } from "./movementBalance";

describe("classifyMuscleCategory", () => {
  it("maps push/pull/lower muscles", () => {
    expect(classifyMuscleCategory("Pecho")).toBe("empuje");
    expect(classifyMuscleCategory("Espalda")).toBe("traccion");
    expect(classifyMuscleCategory("Cuádriceps")).toBe("inferior");
    expect(classifyMuscleCategory("Core")).toBe("core");
    expect(classifyMuscleCategory("Desconocido")).toBe("otro");
  });
});

describe("analyzeMovementBalance", () => {
  it("aggregates sets per category", () => {
    const result = analyzeMovementBalance([
      { muscleGroup: "Pecho", sets: 6 },
      { muscleGroup: "Tríceps", sets: 4 },
      { muscleGroup: "Espalda", sets: 8 },
      { muscleGroup: "Cuádriceps", sets: 6 },
    ]);
    expect(result.byCategory.empuje).toBe(10);
    expect(result.byCategory.traccion).toBe(8);
    expect(result.byCategory.inferior).toBe(6);
  });

  it("does not warn on a balanced push/pull split", () => {
    const result = analyzeMovementBalance([
      { muscleGroup: "Pecho", sets: 9 },
      { muscleGroup: "Espalda", sets: 9 },
      { muscleGroup: "Cuádriceps", sets: 12 },
    ]);
    // upper 18 vs lower 12 -> ratio 1.5 -> flagged; push/pull balanced.
    expect(result.ratios[0].warning).toBeNull();
  });

  it("warns when push greatly exceeds pull", () => {
    const result = analyzeMovementBalance([
      { muscleGroup: "Pecho", sets: 12 },
      { muscleGroup: "Hombro", sets: 6 },
      { muscleGroup: "Espalda", sets: 6 },
    ]);
    // empuje 18 vs traccion 6 -> ratio 3 -> warning
    expect(result.ratios[0].warning).toMatch(/empuje/i);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("returns null ratio when one side has no sets", () => {
    const result = analyzeMovementBalance([{ muscleGroup: "Pecho", sets: 6 }]);
    expect(result.ratios[0].ratio).toBeNull();
    expect(result.ratios[0].warning).toBeNull();
  });
});
