import { getAuthenticatedClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Asociación manual de una actividad de Strava a una sesión de fuerza (workout_logs).
// La propiedad se valida con el cliente RLS del usuario; la escritura va por admin
// (no hay policy de escritura para el cliente sobre strava_activities).
export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await getAuthenticatedClient(req);
  if ("error" in auth) {
    return Response.json({ error: "Inicia sesión." }, { status: 401 });
  }

  const { stravaActivityId, workoutLogId } = await req.json().catch(() => ({}));
  if (!stravaActivityId || !workoutLogId) {
    return Response.json({ error: "Faltan stravaActivityId o workoutLogId." }, { status: 400 });
  }

  // Propiedad de la actividad (RLS: el usuario solo ve las suyas).
  const { data: activity } = await auth.supabase
    .from("strava_activities")
    .select("id")
    .eq("id", stravaActivityId)
    .maybeSingle();
  if (!activity) {
    return Response.json({ error: "Actividad no encontrada." }, { status: 404 });
  }

  // Propiedad del entrenamiento y que esté finalizado.
  const { data: workout } = await auth.supabase
    .from("workout_logs")
    .select("id, end_time")
    .eq("id", workoutLogId)
    .maybeSingle();
  if (!workout) {
    return Response.json({ error: "Entrenamiento no encontrado." }, { status: 404 });
  }

  const admin = createAdminClient();

  // El entrenamiento no puede estar ya asociado a otra actividad.
  const { data: taken } = await admin
    .from("strava_activities")
    .select("id")
    .eq("user_id", auth.user.id)
    .eq("workout_log_id", workoutLogId)
    .neq("id", stravaActivityId)
    .maybeSingle();
  if (taken) {
    return Response.json({ error: "Ese entrenamiento ya tiene una actividad asociada." }, { status: 409 });
  }

  const { error } = await admin
    .from("strava_activities")
    .update({
      workout_log_id: workoutLogId,
      match_status: "matched_manual",
      updated_at: new Date().toISOString(),
    })
    .eq("id", stravaActivityId)
    .eq("user_id", auth.user.id);

  if (error) {
    return Response.json({ error: "No se pudo asociar la actividad." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
