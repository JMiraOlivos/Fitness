// Errores tipados del servicio Strava. Cada código mapea a un comportamiento de UI
// concreto (ver tabla de manejo de errores en la propuesta).

export type StravaErrorCode =
  | "NOT_CONNECTED" // el usuario no ha conectado Strava
  | "AUTH_INVALID" // refresh token inválido/revocado -> pedir reconexión
  | "SCOPE_INSUFFICIENT" // faltan scopes -> reconectar
  | "RATE_LIMITED" // 429 -> reintentar más tarde
  | "UPSTREAM" // 5xx u otros errores de Strava -> no avanzar last_sync_at
  | "CONFIG" // falta configuración/variables de entorno
  | "STATE_INVALID"; // OAuth state manipulado o expirado

export class StravaError extends Error {
  code: StravaErrorCode;
  status?: number;

  constructor(code: StravaErrorCode, message: string, status?: number) {
    super(message);
    this.name = "StravaError";
    this.code = code;
    this.status = status;
  }
}

// Mensajes orientados al usuario final (es-CL). El detalle técnico va en logs, no aquí.
export function userMessageForStravaError(code: StravaErrorCode): string {
  switch (code) {
    case "NOT_CONNECTED":
      return "Conecta tu cuenta de Strava para sincronizar actividades.";
    case "AUTH_INVALID":
      return "Tu conexión con Strava expiró. Vuelve a conectarla.";
    case "SCOPE_INSUFFICIENT":
      return "Faltan permisos en Strava. Reconecta y acepta el acceso a tus actividades.";
    case "RATE_LIMITED":
      return "Strava está limitando las solicitudes. Intenta de nuevo en unos minutos.";
    case "UPSTREAM":
      return "Strava no está disponible en este momento. Intenta más tarde.";
    case "CONFIG":
      return "La integración con Strava no está configurada en el servidor.";
    case "STATE_INVALID":
      return "No pudimos validar la conexión con Strava. Inténtalo otra vez.";
    default:
      return "Ocurrió un error con Strava.";
  }
}
