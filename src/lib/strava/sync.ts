// Orquestación de la sincronización incremental. Usa el service role (admin) porque
// escribe strava_* y lee/crea en nombre del usuario, filtrando SIEMPRE por user_id.

import type { AdminClient } from "../supabaseAdmin";
import { getActivities, getHeartRateStream } from "./client";
import { StravaError } from "./errors";
import {
  CANDIDATE_WINDOW_MS,
  classifyActivity,
  cardioLogType,
  decideMatch,
  type WorkoutCandidate,
} from "./matching";
import { getValidStravaAccessToken, type StravaConnectionRow } from "./tokens";
import type { StravaSummaryActivity } from "./types";
import { minHeartRate, toSamples } from "./zones";

// Solape de seguridad hacia atrás sobre last_sync_at para no perder actividades
// subidas con retraso. El UNIQUE(user_id, strava_activity_id) hace idempotente repetir.
const OVERLAP_MS = 24 * 60 * 60 * 1000;
// Si nunca se ha sincronizado, mirar los últimos 30 días.
const INITIAL_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

export type SyncSummary = {
  reviewed: number;
  imported: number;
  matched: number;
  withHeartRate: number;
};

export async function syncStravaActivities(
  admin: AdminClient,
  userId: string,
  now = Date.now()
): Promise<SyncSummary> {
  const { data: connection, error: connErr } = await admin
    .from("strava_connections")
    .select("user_id, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (connErr) throw new StravaError("UPSTREAM", connErr.message);
  if (!connection) throw new StravaError("NOT_CONNECTED", "Sin conexión de Strava.");

  const accessToken = await getValidStravaAccessToken(admin, connection as StravaConnectionRow, now);

  const { data: connMeta } = await admin
    .from("strava_connections")
    .select("last_sync_at")
    .eq("user_id", userId)
    .maybeSingle();

  const lastSyncMs = connMeta?.last_sync_at ? new Date(connMeta.last_sync_at).getTime() : null;
  const afterMs = lastSyncMs ? lastSyncMs - OVERLAP_MS : now - INITIAL_LOOKBACK_MS;
  const afterEpoch = Math.floor(afterMs / 1000);

  let activities: StravaSummaryActivity[];
  try {
    activities = await getActivities(accessToken, afterEpoch);
  } catch (err) {
    // No avanzamos last_sync_at en fallo transitorio: se podrá reintentar.
    await recordSyncError(admin, userId, err, now);
    throw err;
  }

  const summary: SyncSummary = { reviewed: activities.length, imported: 0, matched: 0, withHeartRate: 0 };

  if (activities.length > 0) {
    // Upsert de datos crudos. Omitimos columnas de asociación (workout_log_id,
    // cardio_log_id, match_status, match_score, min_heartrate, imported_at) para no
    // pisar asociaciones existentes al re-sincronizar.
    const rows = activities.map((a) => ({
      user_id: userId,
      strava_activity_id: a.id,
      name: a.name,
      sport_type: a.sport_type,
      start_date: a.start_date,
      start_date_local: a.start_date_local ?? null,
      timezone: a.timezone ?? null,
      elapsed_time_seconds: a.elapsed_time ?? null,
      moving_time_seconds: a.moving_time ?? null,
      has_heartrate: Boolean(a.has_heartrate),
      average_heartrate: a.average_heartrate ?? null,
      max_heartrate: a.max_heartrate ? Math.round(a.max_heartrate) : null,
      calories: a.calories ?? null,
      distance_meters: a.distance ?? null,
      device_name: a.device_name ?? null,
      updated_at: new Date(now).toISOString(),
    }));

    const { error: upsertErr } = await admin
      .from("strava_activities")
      .upsert(rows, { onConflict: "user_id,strava_activity_id" });
    if (upsertErr) throw new StravaError("UPSTREAM", upsertErr.message);
  }

  // Releer el estado persistido de estas actividades para decidir qué procesar.
  const stravaIds = activities.map((a) => a.id);
  const { data: stored } = stravaIds.length
    ? await admin
        .from("strava_activities")
        .select("id, strava_activity_id, sport_type, start_date, elapsed_time_seconds, moving_time_seconds, distance_meters, has_heartrate, average_heartrate, max_heartrate, workout_log_id, cardio_log_id, match_status")
        .eq("user_id", userId)
        .in("strava_activity_id", stravaIds)
    : { data: [] as any[] };

  const storedRows = stored ?? [];
  summary.imported = storedRows.length;

  // Streams existentes para no re-descargar.
  const activityUuids = storedRows.map((r) => r.id);
  const { data: existingStreams } = activityUuids.length
    ? await admin.from("strava_hr_streams").select("strava_activity_id").in("strava_activity_id", activityUuids)
    : { data: [] as any[] };
  const streamsPresent = new Set((existingStreams ?? []).map((s) => s.strava_activity_id));

  for (const row of storedRows) {
    if (row.has_heartrate) summary.withHeartRate += 1;

    // 1) Stream cardiaco para actividades nuevas con HR y sin stream aún.
    if (row.has_heartrate && !streamsPresent.has(row.id)) {
      try {
        await importStream(admin, userId, row.id, row.strava_activity_id, accessToken);
      } catch (err) {
        // Un fallo de stream no aborta la sync: mantenemos avg/max ya guardados.
        if (err instanceof StravaError && (err.code === "RATE_LIMITED" || err.code === "AUTH_INVALID")) {
          await recordSyncError(admin, userId, err, now);
          throw err;
        }
      }
    }

    // 2) Asociación, solo si sigue sin asociar.
    if (row.match_status === "unmatched") {
      const matched = await matchOne(admin, userId, row, now);
      if (matched) summary.matched += 1;
    }
  }

  await admin
    .from("strava_connections")
    .update({
      last_sync_at: new Date(now).toISOString(),
      last_sync_status: "success",
      last_sync_error: null,
      updated_at: new Date(now).toISOString(),
    })
    .eq("user_id", userId);

  return summary;
}

async function importStream(
  admin: AdminClient,
  userId: string,
  activityUuid: string,
  stravaActivityId: number,
  accessToken: string
): Promise<void> {
  const streams = await getHeartRateStream(accessToken, stravaActivityId);
  const samples = toSamples(streams);
  if (samples.length === 0) return;

  await admin.from("strava_hr_streams").upsert(
    {
      strava_activity_id: activityUuid,
      user_id: userId,
      time_seconds: samples.map((s) => s.second),
      heartrate_bpm: samples.map((s) => s.bpm),
      original_size: streams.heartrate?.original_size ?? null,
      resolution: streams.heartrate?.resolution ?? null,
      sample_count: samples.length,
    },
    { onConflict: "strava_activity_id" }
  );

  const min = minHeartRate(samples);
  if (min !== null) {
    await admin.from("strava_activities").update({ min_heartrate: min }).eq("id", activityUuid);
  }
}

// Devuelve true si la actividad quedó asociada (fuerza) o creó un cardio_log.
async function matchOne(
  admin: AdminClient,
  userId: string,
  row: any,
  now: number
): Promise<boolean> {
  const kind = classifyActivity(row.sport_type);

  if (kind === "cardio") {
    if (row.cardio_log_id) return false;
    const duration = row.moving_time_seconds || row.elapsed_time_seconds || 0;
    if (duration <= 0) return false;

    const { data: cardio, error } = await admin
      .from("cardio_logs")
      .insert({
        user_id: userId,
        type: cardioLogType(row.sport_type),
        duration_seconds: duration,
        distance_meters: row.distance_meters ?? null,
        heart_rate_avg: row.average_heartrate ? Math.round(row.average_heartrate) : null,
        heart_rate_max: row.max_heartrate ?? null,
        notes: `Importado de Strava: ${row.sport_type}`,
      })
      .select("id")
      .single();
    if (error || !cardio) return false;

    await admin
      .from("strava_activities")
      .update({ cardio_log_id: cardio.id, match_status: "matched_auto", updated_at: new Date(now).toISOString() })
      .eq("id", row.id);
    return true;
  }

  if (kind === "strength") {
    const startMs = new Date(row.start_date).getTime();
    const elapsed = (row.elapsed_time_seconds || 0) * 1000;
    const activityWindow = { startMs, endMs: startMs + elapsed };

    // Candidatos: sesiones de fuerza finalizadas del usuario cuyo inicio cae en ±90 min.
    const winStart = new Date(startMs - CANDIDATE_WINDOW_MS).toISOString();
    const winEnd = new Date(startMs + CANDIDATE_WINDOW_MS).toISOString();
    const { data: logs } = await admin
      .from("workout_logs")
      .select("id, start_time, end_time")
      .eq("user_id", userId)
      .not("end_time", "is", null)
      .gte("start_time", winStart)
      .lte("start_time", winEnd);

    if (!logs || logs.length === 0) return false;

    // Excluir workout_logs ya asociados a otra actividad de Strava.
    const candidateIds = logs.map((l) => l.id);
    const { data: taken } = await admin
      .from("strava_activities")
      .select("workout_log_id")
      .eq("user_id", userId)
      .in("workout_log_id", candidateIds);
    const takenSet = new Set((taken ?? []).map((t) => t.workout_log_id));

    const candidates: WorkoutCandidate[] = logs
      .filter((l) => !takenSet.has(l.id))
      .map((l) => ({
        id: l.id,
        startMs: new Date(l.start_time).getTime(),
        endMs: l.end_time ? new Date(l.end_time).getTime() : null,
      }));

    const decision = decideMatch(activityWindow, row.sport_type, candidates);
    if (decision.kind !== "auto") return false;

    await admin
      .from("strava_activities")
      .update({
        workout_log_id: decision.workoutLogId,
        match_status: "matched_auto",
        match_score: decision.score,
        updated_at: new Date(now).toISOString(),
      })
      .eq("id", row.id);
    return true;
  }

  return false; // 'other': queda en staging sin asociar.
}

async function recordSyncError(admin: AdminClient, userId: string, err: unknown, now: number): Promise<void> {
  const message = err instanceof StravaError ? `${err.code}: ${err.message}` : "error";
  await admin
    .from("strava_connections")
    .update({ last_sync_status: "error", last_sync_error: message, updated_at: new Date(now).toISOString() })
    .eq("user_id", userId);
}
