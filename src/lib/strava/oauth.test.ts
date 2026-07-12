import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createOAuthState, verifyOAuthState } from "./oauth";
import { StravaError } from "./errors";

describe("OAuth state", () => {
  beforeAll(() => {
    process.env.STRAVA_STATE_SECRET = "test-secret-please-change";
  });
  afterAll(() => {
    delete process.env.STRAVA_STATE_SECRET;
  });

  const userId = "11111111-1111-1111-1111-111111111111";

  it("roundtrips a signed state and recovers the user id", () => {
    const state = createOAuthState(userId, 1_000_000);
    expect(verifyOAuthState(state, 1_000_500).userId).toBe(userId);
  });

  it("rejects an expired state", () => {
    const state = createOAuthState(userId, 1_000_000);
    // 11 min después (TTL 10 min).
    expect(() => verifyOAuthState(state, 1_000_000 + 11 * 60 * 1000)).toThrow(StravaError);
  });

  it("rejects a tampered signature", () => {
    const state = createOAuthState(userId, 1_000_000);
    const tampered = state.slice(0, -2) + (state.endsWith("aa") ? "bb" : "aa");
    expect(() => verifyOAuthState(tampered, 1_000_500)).toThrow(StravaError);
  });

  it("rejects a state signed with a different secret", () => {
    const state = createOAuthState(userId, 1_000_000);
    process.env.STRAVA_STATE_SECRET = "a-different-secret";
    expect(() => verifyOAuthState(state, 1_000_500)).toThrow(StravaError);
    process.env.STRAVA_STATE_SECRET = "test-secret-please-change";
  });
});
