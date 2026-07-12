import { getAuthenticatedClient, type OptionalAuth } from "@/lib/supabaseServer";
import type { Database } from "@/lib/database.types";

export const runtime = "nodejs";

type ExportData = {
  profile: unknown;
  body_measurements: unknown[];
  routines: unknown[];
  workout_logs: unknown[];
  set_logs: unknown[];
  readiness_logs: unknown[];
  exercise_preferences: unknown[];
  programs: unknown[];
  personal_records: unknown[];
  strava_activities: unknown[];
  strava_hr_streams: unknown[];
};

async function collectUserData(auth: NonNullable<OptionalAuth>): Promise<ExportData> {
  const { supabase, user } = auth;

  const tables = [
    { key: "profile", query: supabase.from("profiles").select("*").eq("id", user.id).single() },
    { key: "body_measurements", query: supabase.from("body_measurements").select("*").eq("user_id", user.id).order("measured_at", { ascending: false }) },
    { key: "routines", query: supabase.from("routines").select(`
      id, title, description, created_at,
      routine_exercises ( id, order_index, target_sets, target_reps, notes, exercises ( id, name, target_muscle, equipment ) )
    `).eq("user_id", user.id).order("created_at", { ascending: false }) },
    { key: "workout_logs", query: supabase.from("workout_logs").select("*").eq("user_id", user.id).order("start_time", { ascending: false }) },
    { key: "set_logs", query: supabase.from("set_logs").select("*, workout_logs!inner(user_id)").eq("workout_logs.user_id", user.id).order("created_at", { ascending: false }) },
    { key: "readiness_logs", query: supabase.from("readiness_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }) },
    { key: "exercise_preferences", query: supabase.from("user_exercise_preferences").select("*").eq("user_id", user.id).order("created_at", { ascending: false }) },
    { key: "programs", query: supabase.from("programs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }) },
    { key: "personal_records", query: supabase.from("personal_records").select("*").eq("user_id", user.id).order("created_at", { ascending: false }) },
    // Datos de Strava del usuario. Las credenciales (strava_connections) NUNCA se
    // exportan: contienen tokens y son inaccesibles por RLS de todos modos.
    { key: "strava_activities", query: supabase.from("strava_activities").select("*").eq("user_id", user.id).order("start_date", { ascending: false }) },
    { key: "strava_hr_streams", query: supabase.from("strava_hr_streams").select("*").eq("user_id", user.id).order("created_at", { ascending: false }) },
  ];

  const result: Record<string, unknown> = {};

  for (const { key, query } of tables) {
    const { data, error } = await query;
    if (error) {
      console.error(`Error fetching ${key}:`, error.message);
      result[key] = null;
    } else {
      result[key] = data;
    }
  }

  return result as ExportData;
}

export async function GET(req: Request) {
  const auth = await getAuthenticatedClient(req);

  if ("error" in auth) {
    return Response.json({ error: "Inicia sesión para exportar tus datos." }, { status: 401 });
  }

  try {
    const data = await collectUserData(auth);
    const json = JSON.stringify(data, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

    return new Response(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="fitness-export-${timestamp}.json"`,
      },
    });
  } catch (error) {
    console.error("Error exporting user data:", error);
    return Response.json({ error: "No se pudieron exportar los datos." }, { status: 500 });
  }
}
