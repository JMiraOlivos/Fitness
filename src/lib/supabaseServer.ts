import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Server-side client scoped to the caller's own access token (not the service role),
// so RLS still applies exactly as it does for direct client calls: auth.uid() resolves
// to that user, and PostgREST rejects the request if the token is invalid or expired.
export function createUserScopedClient(accessToken: string) {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

export async function getAuthenticatedClient(req: Request) {
  const accessToken = getBearerToken(req);

  if (!accessToken) {
    return { error: "AUTH_REQUIRED" as const };
  }

  const supabase = createUserScopedClient(accessToken);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { error: "AUTH_REQUIRED" as const };
  }

  return { supabase, user: data.user };
}
