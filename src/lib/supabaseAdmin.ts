import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Cliente Supabase con service role: SALTA RLS. Uso deliberadamente acotado — la app
// usa clientes con RLS por bearer para todo lo normal (ver supabaseServer.ts). El
// único motivo para el service role es la integración de Strava:
//   * strava_connections guarda credenciales cifradas y tiene RLS sin policies, así
//     que solo es accesible por aquí.
//   * la sincronización escribe strava_activities / strava_hr_streams en nombre del
//     usuario desde el servidor, filtrando SIEMPRE por user_id explícito.
//
// Nunca importar este módulo desde código de cliente. SUPABASE_SERVICE_ROLE_KEY solo
// existe en variables server-side de Vercel (sin prefijo NEXT_PUBLIC_).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AdminClient = ReturnType<typeof createAdminClient>;
