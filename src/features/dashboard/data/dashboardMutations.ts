import { authFetch } from "@/lib/authFetch";
import { supabase } from "@/lib/supabase";
import type { RutinaIA, RutinaResponse } from "../types";

export async function signOut() {
  await supabase.auth.signOut();
}

export async function generateRoutine(params: { diasDisponibles: number; enfoque: string; restricciones: string }) {
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
  let data: (Partial<RutinaResponse> & { error?: string; generationId?: string }) | null = null;
  try {
    data = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    throw new Error("El servidor tardó demasiado o falló al generar la rutina. Intenta de nuevo.");
  }

  if (!response.ok) throw new Error(data?.error || "No se pudo generar la rutina.");

  return { rutinas: data?.rutinas || [], generationId: data?.generationId ?? null };
}

export async function saveRoutine(rutina: RutinaIA) {
  return authFetch("/api/routines/save", { rutina });
}

export async function deleteRoutine(routineId: string) {
  return authFetch("/api/routines/delete", { routineId });
}

export async function generateCoachRecommendations() {
  return authFetch("/api/coach/recommendations", {});
}

export async function markCoachRecommendationRead(recommendationId?: string, markAll?: boolean) {
  return authFetch("/api/coach/recommendations/read", { recommendationId, markAll });
}
