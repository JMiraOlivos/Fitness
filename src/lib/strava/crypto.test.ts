import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "./crypto";
import { StravaError } from "./errors";

const KEY = randomBytes(32).toString("base64");

describe("token crypto", () => {
  beforeAll(() => {
    process.env.STRAVA_TOKEN_ENCRYPTION_KEY = KEY;
  });
  afterAll(() => {
    delete process.env.STRAVA_TOKEN_ENCRYPTION_KEY;
  });

  it("roundtrips a token", () => {
    const secret = "a1b2c3-strava-access-token";
    expect(decryptToken(encryptToken(secret))).toBe(secret);
  });

  it("produces different ciphertexts for the same input (random IV)", () => {
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });

  it("fails to decrypt with a tampered ciphertext", () => {
    const enc = encryptToken("tokentoken");
    const buf = Buffer.from(enc, "base64");
    buf[buf.length - 1] ^= 0xff; // corromper el último byte
    expect(() => decryptToken(buf.toString("base64"))).toThrow();
  });

  it("rejects a key of the wrong length", () => {
    process.env.STRAVA_TOKEN_ENCRYPTION_KEY = Buffer.from("short").toString("base64");
    expect(() => encryptToken("x")).toThrow(StravaError);
    process.env.STRAVA_TOKEN_ENCRYPTION_KEY = KEY;
  });
});
