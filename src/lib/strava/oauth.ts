// OAuth de Strava: construcción de la URL de autorización y state stateless.
//
// El state es un token HMAC firmado (no se guarda en la base): lleva el user_id y una
// expiración, firmados con STRAVA_STATE_SECRET. El callback lo verifica sin tocar la
// base. El "un solo uso" real lo garantiza el `code` de Strava (single-use) + la
// expiración corta del state. Evita una tabla y su limpieza.

import { createHmac, timingSafeEqual } from "node:crypto";
import { StravaError } from "./errors";

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
export const STRAVA_SCOPE = "activity:read_all";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutos

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function getStateSecret(): string {
  const secret = process.env.STRAVA_STATE_SECRET;
  if (!secret) throw new StravaError("CONFIG", "Falta STRAVA_STATE_SECRET.");
  return secret;
}

function sign(payload: string): string {
  return base64url(createHmac("sha256", getStateSecret()).update(payload).digest());
}

// Genera un state firmado: base64url("<userId>.<expiresAtMs>") + "." + firma.
export function createOAuthState(userId: string, now = Date.now()): string {
  const payload = `${userId}.${now + STATE_TTL_MS}`;
  const encoded = base64url(Buffer.from(payload, "utf8"));
  return `${encoded}.${sign(encoded)}`;
}

// Verifica un state y devuelve el userId. Lanza STATE_INVALID si la firma no cuadra
// (comparación en tiempo constante) o si expiró.
export function verifyOAuthState(state: string, now = Date.now()): { userId: string } {
  const parts = state.split(".");
  if (parts.length !== 2) throw new StravaError("STATE_INVALID", "State mal formado.");

  const [encoded, providedSig] = parts;
  const expectedSig = sign(encoded);

  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new StravaError("STATE_INVALID", "Firma de state inválida.");
  }

  const payload = fromBase64url(encoded).toString("utf8");
  const [userId, expiresAtStr] = payload.split(".");
  const expiresAt = Number(expiresAtStr);
  if (!userId || !Number.isFinite(expiresAt)) {
    throw new StravaError("STATE_INVALID", "Payload de state inválido.");
  }
  if (now > expiresAt) {
    throw new StravaError("STATE_INVALID", "State expirado.");
  }
  return { userId };
}

function getClientId(): string {
  const id = process.env.STRAVA_CLIENT_ID;
  if (!id) throw new StravaError("CONFIG", "Falta STRAVA_CLIENT_ID.");
  return id;
}

export function getRedirectUri(): string {
  const explicit = process.env.STRAVA_REDIRECT_URI;
  if (explicit) return explicit;
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) throw new StravaError("CONFIG", "Falta STRAVA_REDIRECT_URI o NEXT_PUBLIC_SITE_URL.");
  return `${site.replace(/\/$/, "")}/api/integrations/strava/callback`;
}

export function buildAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    approval_prompt: "auto",
    scope: STRAVA_SCOPE,
    state,
  });
  return `${STRAVA_AUTHORIZE_URL}?${params.toString()}`;
}

// Comprueba que los scopes concedidos incluyan lectura de actividades. Strava puede
// conceder un subconjunto de lo solicitado.
export function hasRequiredScopes(scopes: string[]): boolean {
  return scopes.includes("activity:read_all") || scopes.includes("activity:read");
}
