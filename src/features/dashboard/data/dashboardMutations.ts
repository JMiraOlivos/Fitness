import { authFetch } from "@/lib/authFetch";
import { supabase } from "@/lib/supabase";
import type { RutinaIA, RutinaResponse } from "../types";

export async function signOut() {
  await supabase.auth.signOut();
}

export async function generateRoutine(params: { diasDisponibles: number; enfoque: string; restricciones: string }) {
  // Best-effort: attach the access token when logged in so the route can merge
  // profile preferences (see /perfil); anonymous callers still get a preview.
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const response = await fetch("/api/ai/generar-rutina", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(params),
  });

  const rawBody = await response.text();
  let data: (Partial<RutinaResponse> & { error?: string }) | null = null;
  try {
    data = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    // The platform (timeout, crash, ...) returned a non-JSON error page instead of
    // our API route's JSON response — surface a readable message instead of the
    // raw JSON.parse failure.
    throw new Error("El servidor tardó demasiado o falló al generar la rutina. Intenta de nuevo.");
  }

  if (!response.ok) throw new Error(data?.error || "No se pudo generar la rutina.");

  return data?.rutinas || [];
}

export async function saveRoutine(rutina: RutinaIA) {
  return authFetch("/api/routines/save", { rutina });
}

export async function deleteRoutine(routineId: string) {
  return authFetch("/api/routines/delete", { routineId });
}
