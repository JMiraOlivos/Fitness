import { getAuthenticatedClient } from "@/lib/supabaseServer";

export const runtime = "edge";

export async function POST(req: Request) {
  const auth = await getAuthenticatedClient(req);

  if ("error" in auth) {
    return Response.json({ error: "Inicia sesión para finalizar entrenamientos." }, { status: 401 });
  }

  const { workoutLogId, aiInsight } = await req.json();

  if (!workoutLogId) {
    return Response.json({ error: "Falta el entrenamiento a finalizar." }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("workout_logs")
    .update({
      end_time: new Date().toISOString(),
      ai_insight: aiInsight ?? null,
    })
    .eq("id", workoutLogId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
