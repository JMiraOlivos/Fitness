import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Server-side client scoped to the caller's own access token (not the service role),
// so RLS still applies exactly as it does for direct client calls: auth.uid() resolves
// to that user, and PostgREST rejects the request if the token is invalid or expired.
export function createUserScopedClient(accessToken: string) {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

export async function getAuthenticatedClient(req: Request) {
  const accessToken = getBearerToken(req);

  if (!accessToken) {
    return { error: "AUTH_REQUIRED" as const };
  }

  const supabase = createUserScopedClient(accessToken);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { error: "AUTH_REQUIRED" as const };
  }

  return { supabase, user: data.user };
}

// Resolves auth once so routes that want more than one piece of optional
// personalization (profile, performance history, ...) don't each re-validate the
// token. Returns null for anonymous/invalid callers — routes should keep working
// without personalization in that case, not fail.
export async function resolveOptionalAuth(req: Request) {
  const auth = await getAuthenticatedClient(req);
  return "error" in auth ? null : auth;
}

type OptionalAuth = Awaited<ReturnType<typeof resolveOptionalAuth>>;

// Best-effort profile lookup for routes that should still work for anonymous callers
// (e.g. previewing a routine before signing up) but personalize when a valid token is
// present. Never throws — a null auth context (missing/invalid token) just yields null.
export async function getOptionalUserProfile(auth: OptionalAuth) {
  if (!auth) return null;

  const { data } = await auth.supabase
    .from("profiles")
    .select("training_goal, injury_notes, equipment_available, experience_level")
    .eq("id", auth.user.id)
    .maybeSingle();

  return data;
}

export type RecentPerformance = {
  exerciseName: string;
  targetMuscle: string;
  weight: number;
  reps: number;
  rpe: number | null;
  daysAgo: number;
};

// The most recent working (non-warmup) set per exercise, newest first, capped so the
// generar-rutina prompt stays a reasonable size. Best-effort like getOptionalUserProfile.
export async function getRecentPerformanceSummary(auth: OptionalAuth, limit = 15): Promise<RecentPerformance[]> {
  if (!auth) return [];

  const { data } = await auth.supabase
    .from("set_logs")
    .select("exercise_id, weight, reps, rpe, created_at, exercises ( name, target_muscle )")
    .eq("is_warmup", false)
    .order("created_at", { ascending: false })
    .limit(300);

  if (!data) return [];

  const seenExerciseIds = new Set<string>();
  const summary: RecentPerformance[] = [];
  const now = Date.now();

  for (const row of data) {
    if (seenExerciseIds.has(row.exercise_id)) continue;
    seenExerciseIds.add(row.exercise_id);

    const exercise = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
    if (!exercise) continue;

    const daysAgo = Math.max(0, Math.round((now - new Date(row.created_at).getTime()) / 86_400_000));

    summary.push({
      exerciseName: exercise.name,
      targetMuscle: exercise.target_muscle,
      weight: Number(row.weight),
      reps: Number(row.reps),
      rpe: row.rpe === null ? null : Number(row.rpe),
      daysAgo,
    });

    if (summary.length >= limit) break;
  }

  return summary;
}

export type ExerciseSessionPoint = {
  volume: number;
  maxWeight: number;
  averageRpe: number | null;
  daysAgo: number;
};

// Per-exercise aggregates for the last few prior workout sessions (excluding the one
// just finished), newest first — lets the post-workout insight reason about a real
// trend across sessions instead of only the numbers from today. Best-effort: an
// anonymous/invalid-token caller (or no exercise ids) just yields no history.
export async function getExerciseSessionHistory(
  auth: OptionalAuth,
  exerciseIds: string[],
  excludeWorkoutLogId: string | null,
  sessionsPerExercise = 4
): Promise<Record<string, ExerciseSessionPoint[]>> {
  if (!auth || exerciseIds.length === 0) return {};

  const { data } = await auth.supabase
    .from("set_logs")
    .select("exercise_id, workout_log_id, weight, reps, rpe, created_at")
    .in("exercise_id", exerciseIds)
    .eq("is_warmup", false)
    .order("created_at", { ascending: false })
    .limit(500);

  if (!data) return {};

  type SessionAgg = {
    volume: number;
    maxWeight: number;
    rpeSum: number;
    rpeCount: number;
    latestCreatedAt: string;
  };

  const byExercise = new Map<string, Map<string, SessionAgg>>();

  for (const row of data) {
    if (excludeWorkoutLogId && row.workout_log_id === excludeWorkoutLogId) continue;

    let sessions = byExercise.get(row.exercise_id);
    if (!sessions) {
      sessions = new Map();
      byExercise.set(row.exercise_id, sessions);
    }

    let session = sessions.get(row.workout_log_id);
    if (!session) {
      session = { volume: 0, maxWeight: 0, rpeSum: 0, rpeCount: 0, latestCreatedAt: row.created_at };
      sessions.set(row.workout_log_id, session);
    }

    const weight = Number(row.weight);
    const reps = Number(row.reps);
    session.volume += weight * reps;
    session.maxWeight = Math.max(session.maxWeight, weight);
    if (row.rpe !== null) {
      session.rpeSum += Number(row.rpe);
      session.rpeCount += 1;
    }
  }

  const now = Date.now();
  const result: Record<string, ExerciseSessionPoint[]> = {};

  for (const [exerciseId, sessions] of byExercise) {
    result[exerciseId] = Array.from(sessions.values())
      .sort((a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime())
      .slice(0, sessionsPerExercise)
      .map((session) => ({
        volume: session.volume,
        maxWeight: session.maxWeight,
        averageRpe: session.rpeCount > 0 ? session.rpeSum / session.rpeCount : null,
        daysAgo: Math.max(0, Math.round((now - new Date(session.latestCreatedAt).getTime()) / 86_400_000)),
      }));
  }

  return result;
}
