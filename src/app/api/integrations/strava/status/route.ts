import { getAuthenticatedClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Estado de la conexión: solo información NO sensible (nunca tokens).
export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await getAuthenticatedClient(req);
  if ("error" in auth) {
    return Response.json({ error: "Inicia sesión." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("strava_connections")
    .select("athlete_name, status, last_sync_at, last_sync_status, last_sync_error")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return Response.json({ error: "No se pudo consultar el estado." }, { status: 500 });
  }

  if (!data || data.status === "revoked") {
    return Response.json({ connected: false });
  }

  return Response.json({
    connected: true,
    status: data.status,
    athleteName: data.athlete_name,
    lastSyncAt: data.last_sync_at,
    lastSyncStatus: data.last_sync_status,
    lastSyncError: data.status === "error" ? data.last_sync_error : null,
  });
}
