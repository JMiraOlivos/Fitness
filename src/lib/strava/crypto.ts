// Cifrado de los tokens de Strava en reposo. AES-256-GCM con node:crypto (las rutas
// de Strava corren con runtime = "nodejs"). La clave es STRAVA_TOKEN_ENCRYPTION_KEY:
// 32 bytes aleatorios en Base64, DISTINTA de STRAVA_CLIENT_SECRET.
//
// Formato del ciphertext persistido:  base64( iv[12] || authTag[16] || cipher )
// Todo en una sola cadena para guardar en una columna text.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { StravaError } from "./errors";

const IV_BYTES = 12; // recomendado para GCM
const TAG_BYTES = 16;

function getKey(): Buffer {
  const raw = process.env.STRAVA_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    throw new StravaError("CONFIG", "Falta STRAVA_TOKEN_ENCRYPTION_KEY.");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new StravaError(
      "CONFIG",
      "STRAVA_TOKEN_ENCRYPTION_KEY debe ser 32 bytes en Base64."
    );
  }
  return key;
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptToken(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, "base64");
  if (buf.length < IV_BYTES + TAG_BYTES) {
    throw new StravaError("CONFIG", "Ciphertext de token inválido.");
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const encrypted = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
