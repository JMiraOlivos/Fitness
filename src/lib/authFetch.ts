import { supabase } from "./supabase";

// POSTs to an internal API route with the caller's Supabase access token attached,
// so the route handler can construct a request-scoped client and let RLS apply
// exactly as it would for a direct client-side call.
export async function authFetch<T>(path: string, body: unknown): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error("Inicia sesión para continuar.");
  }

  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "No se pudo completar la solicitud.");
  }

  return data as T;
}
