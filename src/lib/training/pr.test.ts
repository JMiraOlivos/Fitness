import { test, expect } from "vitest";
import { detectPRs } from "./pr";
import type { HistoricalBests } from "./pr";

test("first time always yields PRs", () => {
  const prs = detectPRs("ex1", 80, 10, 2400, {});
  expect(prs.length).toBeGreaterThanOrEqual(3);
  expect(prs.some((pr) => pr.metric === "weight" && pr.previousBest === null)).toBe(true);
  expect(prs.some((pr) => pr.metric === "reps" && pr.previousBest === null)).toBe(true);
  expect(prs.some((pr) => pr.metric === "volume" && pr.previousBest === null)).toBe(true);
});

test("beating weight PR", () => {
  const bests: Record<string, HistoricalBests> = { ex1: { maxWeight: 80, maxReps: 12, maxVolume: 3000, maxOneRepMax: 100 } };
  const prs = detectPRs("ex1", 85, 10, 2500, bests);
  expect(prs.some((pr) => pr.metric === "weight" && pr.value === 85)).toBe(true);
  expect(prs.some((pr) => pr.metric === "reps")).toBe(false);
  expect(prs.some((pr) => pr.metric === "volume")).toBe(false);
});

test("beating reps PR", () => {
  const bests: Record<string, HistoricalBests> = { ex1: { maxWeight: 80, maxReps: 10, maxVolume: 3000, maxOneRepMax: 100 } };
  const prs = detectPRs("ex1", 70, 12, 2000, bests);
  expect(prs.some((pr) => pr.metric === "reps" && pr.value === 12)).toBe(true);
});

test("beating volume PR through accumulated sets", () => {
  const bests: Record<string, HistoricalBests> = { ex1: { maxWeight: 80, maxReps: 12, maxVolume: 2000, maxOneRepMax: 100 } };
  const prs = detectPRs("ex1", 70, 10, 2500, bests);
  expect(prs.some((pr) => pr.metric === "volume" && pr.value === 2500)).toBe(true);
});

test("beating 1RM PR", () => {
  const bests: Record<string, HistoricalBests> = { ex1: { maxWeight: 80, maxReps: 12, maxVolume: 3000, maxOneRepMax: 95 } };
  const prs = detectPRs("ex1", 85, 10, 2500, bests);
  expect(prs.some((pr) => pr.metric === "one_rep_max" && pr.value > 95)).toBe(true);
});

test("no PR when values are below", () => {
  const bests: Record<string, HistoricalBests> = { ex1: { maxWeight: 100, maxReps: 15, maxVolume: 5000, maxOneRepMax: 130 } };
  const prs = detectPRs("ex1", 80, 10, 800, bests);
  expect(prs.length).toBe(0);
});

test("no PR for null 1RM (reps > 12)", () => {
  const bests: Record<string, HistoricalBests> = { ex1: { maxWeight: 80, maxReps: 10, maxVolume: 2000, maxOneRepMax: null } };
  const prs = detectPRs("ex1", 90, 14, 2000, bests);
  const oneRmPrs = prs.filter((pr) => pr.metric === "one_rep_max");
  expect(oneRmPrs.length).toBe(0);
});
