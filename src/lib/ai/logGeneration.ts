import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { AI_MODEL, PROMPT_VERSIONS, SCHEMA_VERSIONS, type AiGenerationType } from "./promptVersions";

export type LogAiGenerationParams = {
  // A user-scoped client (RLS applies) — pass null for anonymous callers, in
  // which case this is a no-op, matching the rest of the best-effort personalization
  // pattern in this codebase (getOptionalUserProfile, getRecentPerformanceSummary).
  supabase: SupabaseClient<Database> | null;
  userId: string | null;
  type: AiGenerationType;
  input: unknown;
  output: unknown;
  latencyMs: number;
  success: boolean;
  error?: string | null;
};

// Best-effort: a failed log write must never break the AI route it's observing.
// Returns the inserted row ID so callers can wire it to the AI feedback component.
export async function logAiGeneration(params: LogAiGenerationParams): Promise<string | null> {
  if (!params.supabase || !params.userId) return null;

  const { data, error } = await params.supabase.from("ai_generations").insert({
    user_id: params.userId,
    type: params.type,
    model: AI_MODEL,
    prompt_version: PROMPT_VERSIONS[params.type],
    schema_version: SCHEMA_VERSIONS[params.type],
    input: params.input as never,
    output: params.output as never,
    latency_ms: Math.round(params.latencyMs),
    success: params.success,
    error: params.error ?? null,
  }).select("id").single();

  if (error) {
    console.error("No se pudo registrar la generación de IA:", error.message);
    return null;
  }

  return (data as { id: string } | null)?.id ?? null;
}
