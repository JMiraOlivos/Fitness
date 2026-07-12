// Gestión del ciclo de vida del access token de Strava.
//
// Strava: los access tokens duran ~6 horas y el refresh token PUEDE rotar en cada
// renovación. Por eso, tras renovar, persistimos SIEMPRE el refresh token más reciente
// de inmediato (si no, la siguiente renovación fallaría con el refresh viejo).

import type { AdminClient } from "../supabaseAdmin";
import { refreshAccessToken } from "./client";
import { decryptToken, encryptToken } from "./crypto";
import { StravaError } from "./errors";

// Renueva si faltan menos de 60 min para expirar. Umbral holgado para no correr riesgo
// de usar un token a punto de caducar en mitad de una sincronización.
const REFRESH_THRESHOLD_MS = 60 * 60 * 1000;

export type StravaConnectionRow = {
  user_id: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  token_expires_at: string;
  status: string;
};

export async function getValidStravaAccessToken(
  admin: AdminClient,
  connection: StravaConnectionRow,
  now = Date.now()
): Promise<string> {
  if (connection.status !== "connected") {
    throw new StravaError("AUTH_INVALID", "La conexión de Strava no está activa.");
  }

  const expiresAt = new Date(connection.token_expires_at).getTime();
  if (expiresAt - now > REFRESH_THRESHOLD_MS) {
    return decryptToken(connection.access_token_ciphertext);
  }

  // Necesita renovación.
  const refreshToken = decryptToken(connection.refresh_token_ciphertext);
  let refreshed;
  try {
    refreshed = await refreshAccessToken(refreshToken);
  } catch (err) {
    if (err instanceof StravaError && err.code === "AUTH_INVALID") {
      // Refresh inválido/revocado: marca la conexión y pide reconexión.
      await admin
        .from("strava_connections")
        .update({ status: "error", last_sync_error: "refresh_token inválido", updated_at: new Date(now).toISOString() })
        .eq("user_id", connection.user_id);
    }
    throw err;
  }

  await admin
    .from("strava_connections")
    .update({
      access_token_ciphertext: encryptToken(refreshed.access_token),
      refresh_token_ciphertext: encryptToken(refreshed.refresh_token),
      token_expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
      status: "connected",
      updated_at: new Date(now).toISOString(),
    })
    .eq("user_id", connection.user_id);

  return refreshed.access_token;
}
