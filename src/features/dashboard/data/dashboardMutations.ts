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

  const data = (await response.json()) as Partial<RutinaResponse> & { error?: string };
  if (!response.ok) throw new Error(data.error || "No se pudo generar la rutina.");

  return data.rutinas || [];
}

export async function saveRoutine(rutina: RutinaIA) {
  return authFetch("/api/routines/save", { rutina });
}

export async function deleteRoutine(routineId: string) {
  return authFetch("/api/routines/delete", { routineId });
}
