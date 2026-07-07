import { describe, expect, it } from "vitest";
import { one } from "./supabaseJoins";

describe("one", () => {
  it("returns null for null", () => {
    expect(one(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(one(undefined)).toBeNull();
  });

  it("returns null for an empty array", () => {
    expect(one([])).toBeNull();
  });

  it("returns the first element of a non-empty array", () => {
    expect(one([{ id: "a" }, { id: "b" }])).toEqual({ id: "a" });
  });

  it("returns a plain value unchanged", () => {
    expect(one({ id: "a" })).toEqual({ id: "a" });
  });
});
