import { describe, expect, it } from "vitest";
import { classifyVolume } from "./volumeTargets";

describe("classifyVolume", () => {
  it("flags below-range volume as bajo", () => {
    expect(classifyVolume("Cuádriceps", 4)).toBe("bajo");
  });

  it("flags within-range volume as correcto", () => {
    expect(classifyVolume("Pecho", 14)).toBe("correcto");
  });

  it("flags above-range volume as alto", () => {
    expect(classifyVolume("Espalda", 22)).toBe("alto");
  });

  it("treats the range boundaries as correcto", () => {
    expect(classifyVolume("Hombro", 8)).toBe("correcto");
    expect(classifyVolume("Hombro", 16)).toBe("correcto");
  });

  it("returns desconocido for an unrecognized muscle group", () => {
    expect(classifyVolume("General", 10)).toBe("desconocido");
  });
});
