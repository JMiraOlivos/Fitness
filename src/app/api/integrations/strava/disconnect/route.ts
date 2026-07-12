import { getAuthenticatedClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { getValidStravaAccessToken, type StravaConnectionRow } from "@/lib/strava/tokens";

// Desconexión: revoca el token en Strava (best-effort), borra la conexión (y por tanto
// los tokens), y por defecto conserva las métricas ya importadas. Con
// deleteImportedData:true elimina también strava_activities (los streams caen por
// cascade). Los cardio_logs creados desde Strava se conservan: ya son historial cardio.
export const runtime = "nodejs";

const DEAUTHORIZE_URL = "https://www.strava.com/oauth/deauthorize";

export async function DELETE(req: Request) {
  const auth = await getAuthenticatedClient(req);
  if ("error" in auth) {
    return Response.json({ error: "Inicia sesión." }, { status: 401 });
  }

  let deleteImportedData = false;
  try {
    const body = await req.json();
    deleteImportedData = Boolean(body?.deleteImportedData);
  } catch {
    // Sin body: comportamiento por defecto (conservar datos).
  }

  const admin = createAdminClient();

  const { data: connection } = await admin
    .from("strava_connections")
    .select("user_id, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, status")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  // Revocar en Strava (best-effort; no bloquea el borrado local).
  if (connection) {
    try {
      const accessToken = await getValidStravaAccessToken(admin, connection as StravaConnectionRow);
      await fetch(DEAUTHORIZE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      console.error("Strava deauthorize best-effort failed:", err);
    }
  }

  if (deleteImportedData) {
    await admin.from("strava_activities").delete().eq("user_id", auth.user.id);
  }

  const { error } = await admin.from("strava_connections").delete().eq("user_id", auth.user.id);
  if (error) {
    return Response.json({ error: "No se pudo desconectar Strava." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
