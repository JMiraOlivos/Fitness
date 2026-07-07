import { describe, expect, it } from "vitest";
import { buildWeeklyRecommendations } from "./weeklyRecommendation";

describe("buildWeeklyRecommendations", () => {
  it("returns nothing when everything is on track", () => {
    const result = buildWeeklyRecommendations({
      lowVolumeMuscleGroups: [],
      highVolumeMuscleGroups: [],
      fatiguedExerciseNames: [],
      adherence: { planned: 4, completed: 4 },
    });
    expect(result).toHaveLength(0);
  });

  it("flags low volume muscle groups", () => {
    const result = buildWeeklyRecommendations({
      lowVolumeMuscleGroups: ["Cuádriceps"],
      highVolumeMuscleGroups: [],
      fatiguedExerciseNames: [],
      adherence: null,
    });
    expect(result[0]).toMatch(/Volumen bajo en Cuádriceps/);
  });

  it("flags high volume muscle groups", () => {
    const result = buildWeeklyRecommendations({
      lowVolumeMuscleGroups: [],
      highVolumeMuscleGroups: ["Espalda"],
      fatiguedExerciseNames: [],
      adherence: null,
    });
    expect(result[0]).toMatch(/Volumen alto en Espalda/);
  });

  it("flags fatigued exercises", () => {
    const result = buildWeeklyRecommendations({
      lowVolumeMuscleGroups: [],
      highVolumeMuscleGroups: [],
      fatiguedExerciseNames: ["Press banca"],
      adherence: null,
    });
    expect(result[0]).toMatch(/fatiga en Press banca/);
  });

  it("flags low adherence but not when the plan is met", () => {
    const behind = buildWeeklyRecommendations({
      lowVolumeMuscleGroups: [],
      highVolumeMuscleGroups: [],
      fatiguedExerciseNames: [],
      adherence: { planned: 4, completed: 2 },
    });
    expect(behind[0]).toMatch(/2\/4/);

    const onTrack = buildWeeklyRecommendations({
      lowVolumeMuscleGroups: [],
      highVolumeMuscleGroups: [],
      fatiguedExerciseNames: [],
      adherence: { planned: 4, completed: 4 },
    });
    expect(onTrack).toHaveLength(0);
  });

  it("combines multiple signals in a stable order", () => {
    const result = buildWeeklyRecommendations({
      lowVolumeMuscleGroups: ["Cuádriceps"],
      highVolumeMuscleGroups: ["Espalda"],
      fatiguedExerciseNames: ["Press banca"],
      adherence: { planned: 4, completed: 2 },
    });
    expect(result).toHaveLength(4);
  });
});
