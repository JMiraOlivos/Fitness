// Wrapper de fetch para la API v3 de Strava: añade el bearer, mapea códigos de estado
// a StravaError tipados, captura headers de rate limit y NUNCA registra tokens.

import { StravaError } from "./errors";
import type { StravaSummaryActivity, StravaStreamSet, StravaTokenResponse } from "./types";

const API_BASE = "https://www.strava.com/api/v3";
const OAUTH_TOKEN_URL = "https://www.strava.com/oauth/token";

export type RateLimit = {
  limit: string | null;
  usage: string | null;
  readLimit: string | null;
  readUsage: string | null;
};

export function readRateLimit(res: Response): RateLimit {
  return {
    limit: res.headers.get("x-ratelimit-limit"),
    usage: res.headers.get("x-ratelimit-usage"),
    readLimit: res.headers.get("x-readratelimit-limit"),
    readUsage: res.headers.get("x-readratelimit-usage"),
  };
}

function mapError(status: number, body: string): StravaError {
  if (status === 401) return new StravaError("AUTH_INVALID", "Strava 401 (token inválido).", 401);
  if (status === 403) return new StravaError("SCOPE_INSUFFICIENT", "Strava 403 (permiso/scope).", 403);
  if (status === 429) return new StravaError("RATE_LIMITED", "Strava 429 (rate limit).", 429);
  if (status >= 500) return new StravaError("UPSTREAM", `Strava ${status}.`, status);
  return new StravaError("UPSTREAM", `Strava ${status}: ${body.slice(0, 200)}`, status);
}

async function apiGet<T>(accessToken: string, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw mapError(res.status, body);
  }
  return (await res.json()) as T;
}

// Intercambio de código de autorización por tokens.
export async function exchangeCodeForTokens(code: string): Promise<StravaTokenResponse> {
  return oauthTokenRequest({
    grant_type: "authorization_code",
    code,
  });
}

// Renovación con refresh token.
export async function refreshAccessToken(refreshToken: string): Promise<StravaTokenResponse> {
  return oauthTokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

async function oauthTokenRequest(extra: Record<string, string>): Promise<StravaTokenResponse> {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new StravaError("CONFIG", "Faltan STRAVA_CLIENT_ID/STRAVA_CLIENT_SECRET.");
  }
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, ...extra }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Un refresh rechazado (400/401) significa que la autorización ya no es válida.
    if (res.status === 400 || res.status === 401) {
      throw new StravaError("AUTH_INVALID", "Strava rechazó el refresh token.", res.status);
    }
    throw mapError(res.status, body);
  }
  return (await res.json()) as StravaTokenResponse;
}

// Actividades del atleta posteriores a `afterEpochSeconds`, más recientes primero.
export function getActivities(
  accessToken: string,
  afterEpochSeconds: number,
  perPage = 50
): Promise<StravaSummaryActivity[]> {
  const params = new URLSearchParams({
    after: String(afterEpochSeconds),
    per_page: String(perPage),
    page: "1",
  });
  return apiGet<StravaSummaryActivity[]>(accessToken, `/athlete/activities?${params.toString()}`);
}

// Streams time+heartrate de una actividad (key_by_type para recibir un objeto).
export function getHeartRateStream(accessToken: string, activityId: number): Promise<StravaStreamSet> {
  return apiGet<StravaStreamSet>(
    accessToken,
    `/activities/${activityId}/streams?keys=time,heartrate&key_by_type=true`
  );
}
