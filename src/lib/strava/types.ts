// Formas de las respuestas de la API de Strava que consumimos, y tipos internos
// compartidos por el servicio. Solo los campos que usamos, no el esquema completo.

export type StravaTokenResponse = {
  token_type: string;
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  expires_in: number;
  athlete?: {
    id: number;
    firstname?: string | null;
    lastname?: string | null;
  };
};

// GET /athlete/activities (resumen). No trae stream ni device_name.
export type StravaSummaryActivity = {
  id: number;
  name: string;
  sport_type: string;
  type?: string;
  start_date: string; // ISO UTC
  start_date_local: string; // ISO en hora local del atleta
  timezone: string;
  elapsed_time: number; // segundos
  moving_time: number; // segundos
  distance?: number; // metros
  has_heartrate?: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  device_name?: string | null;
};

// GET /activities/{id}/streams?keys=time,heartrate&key_by_type=true
export type StravaStreamSet = {
  time?: { data: number[]; original_size?: number; resolution?: string };
  heartrate?: { data: number[]; original_size?: number; resolution?: string };
};

// Par (segundo, bpm) normalizado a partir de los streams paralelos de Strava.
export type HeartRateSample = { second: number; bpm: number };

// Clasificación de una actividad de Strava según cómo debe asociarse en Fitness.
export type ActivityKind = "strength" | "cardio" | "other";
