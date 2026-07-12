import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { exchangeCodeForTokens } from "@/lib/strava/client";
import { encryptToken } from "@/lib/strava/crypto";
import { verifyOAuthState, hasRequiredScopes } from "@/lib/strava/oauth";
import { StravaError } from "@/lib/strava/errors";

// Callback OAuth. Recupera el user_id del `state` firmado (no hay bearer aquí),
// intercambia el code por tokens, los cifra y guarda la conexión. Siempre redirige a
// /perfil con un parámetro de estado, nunca devuelve JSON crudo al navegador.
export const runtime = "nodejs";

function redirectToProfile(req: Request, params: Record<string, string>) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const url = new URL("/perfil", site);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url.toString());
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error"); // p.ej. "access_denied"

  if (oauthError) {
    return redirectToProfile(req, { strava: "cancelled" });
  }
  if (!code || !state) {
    return redirectToProfile(req, { strava: "error" });
  }

  let userId: string;
  try {
    ({ userId } = verifyOAuthState(state));
  } catch {
    return redirectToProfile(req, { strava: "state_invalid" });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    const scopeParam = url.searchParams.get("scope") || "";
    const scopes = scopeParam ? scopeParam.split(",") : [];
    if (scopes.length > 0 && !hasRequiredScopes(scopes)) {
      return redirectToProfile(req, { strava: "scope" });
    }

    const athleteName = tokens.athlete
      ? [tokens.athlete.firstname, tokens.athlete.lastname].filter(Boolean).join(" ").trim() || null
      : null;

    const admin = createAdminClient();
    const { error } = await admin.from("strava_connections").upsert(
      {
        user_id: userId,
        athlete_id: tokens.athlete?.id ?? 0,
        athlete_name: athleteName,
        access_token_ciphertext: encryptToken(tokens.access_token),
        refresh_token_ciphertext: encryptToken(tokens.refresh_token),
        token_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
        scopes,
        status: "connected",
        last_sync_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("Strava callback upsert error:", error.message);
      return redirectToProfile(req, { strava: "error" });
    }

    return redirectToProfile(req, { strava: "connected" });
  } catch (err) {
    if (err instanceof StravaError) {
      console.error("Strava callback error:", err.code, err.message);
      return redirectToProfile(req, { strava: "error" });
    }
    console.error("Strava callback unexpected error:", err);
    return redirectToProfile(req, { strava: "error" });
  }
}

// Evita cualquier caché de la redirección de callback.
export const dynamic = "force-dynamic";
