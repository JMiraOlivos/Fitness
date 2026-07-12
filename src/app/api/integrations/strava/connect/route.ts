import { getAuthenticatedClient } from "@/lib/supabaseServer";
import { buildAuthorizationUrl, createOAuthState } from "@/lib/strava/oauth";
import { StravaError, userMessageForStravaError } from "@/lib/strava/errors";

// Devuelve la URL de autorización de Strava. El navegador redirige a ella; el bearer de
// Supabase NO viaja al callback, por eso el user_id va firmado dentro del `state`.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await getAuthenticatedClient(req);
  if ("error" in auth) {
    return Response.json({ error: "Inicia sesión para conectar Strava." }, { status: 401 });
  }

  try {
    const state = createOAuthState(auth.user.id);
    const authorizationUrl = buildAuthorizationUrl(state);
    return Response.json({ authorizationUrl });
  } catch (err) {
    if (err instanceof StravaError) {
      return Response.json({ error: userMessageForStravaError(err.code) }, { status: 500 });
    }
    return Response.json({ error: "No se pudo iniciar la conexión con Strava." }, { status: 500 });
  }
}
