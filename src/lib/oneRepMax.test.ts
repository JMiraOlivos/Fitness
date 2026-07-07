import { describe, expect, it } from "vitest";
import { estimateOneRepMax } from "./oneRepMax";

describe("estimateOneRepMax", () => {
  it("returns null when weight is 0", () => {
    expect(estimateOneRepMax(0, 10)).toBeNull();
  });

  it("returns null when reps is 0", () => {
    expect(estimateOneRepMax(100, 0)).toBeNull();
  });

  it("estimates at the 12-rep boundary (still reliable)", () => {
    expect(estimateOneRepMax(100, 12)).toBeCloseTo(140, 5);
  });

  it("returns null past the 12-rep reliability limit", () => {
    expect(estimateOneRepMax(100, 13)).toBeNull();
  });

  it("estimates with the Epley formula for a typical set", () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(100 * (1 + 5 / 30), 5);
  });
});
