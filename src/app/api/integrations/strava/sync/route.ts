import { getAuthenticatedClient } from "@/lib/supabaseServer";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { syncStravaActivities } from "@/lib/strava/sync";
import { StravaError, userMessageForStravaError } from "@/lib/strava/errors";

// Sincronización manual bajo demanda (botón "Sincronizar ahora").
export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await getAuthenticatedClient(req);
  if ("error" in auth) {
    return Response.json({ error: "Inicia sesión para sincronizar." }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const summary = await syncStravaActivities(admin, auth.user.id);
    return Response.json({ ok: true, summary });
  } catch (err) {
    if (err instanceof StravaError) {
      const status = err.code === "RATE_LIMITED" ? 429 : err.code === "NOT_CONNECTED" ? 400 : 502;
      return Response.json({ error: userMessageForStravaError(err.code), code: err.code }, { status });
    }
    console.error("Strava sync error:", err);
    return Response.json({ error: "No se pudo sincronizar con Strava." }, { status: 500 });
  }
}
