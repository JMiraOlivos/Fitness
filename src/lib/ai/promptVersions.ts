// Central version tags for the 3 AI routes (ROADMAP.md, Fase vNext 10). Bump the
// relevant entry whenever the prompt text or the Zod schema for that route changes
// meaningfully — ai_generations.prompt_version/schema_version let you compare
// generations across versions instead of only seeing "it changed at some point".
export const AI_GENERATION_TYPES = ["routine_generation", "routine_regeneration", "workout_insight"] as const;

export type AiGenerationType = (typeof AI_GENERATION_TYPES)[number];

export const AI_MODEL = "gemini-2.5-flash";

export const PROMPT_VERSIONS: Record<AiGenerationType, string> = {
  // v2: prompt now requires rest/RPE/RIR/tempo/priority/progression/substitution
  // per exercise (vNext Fase 1) instead of just sets/reps/notes.
  routine_generation: "v2",
  routine_regeneration: "v2",
  // Unversioned since Fase 8 added multi-session trend context; no schema/prompt
  // change since.
  workout_insight: "v1",
};

export const SCHEMA_VERSIONS: Record<AiGenerationType, string> = {
  routine_generation: "v2",
  routine_regeneration: "v2",
  workout_insight: "v1",
};
