import { getAuthenticatedClient } from "@/lib/supabaseServer";

export const runtime = "edge";

export async function POST(req: Request) {
  const auth = await getAuthenticatedClient(req);

  if ("error" in auth) {
    return Response.json({ error: "Inicia sesión para enviar feedback." }, { status: 401 });
  }

  try {
    const { generationId, feedback } = await req.json();

    if (!generationId || !["thumbs_up", "thumbs_down"].includes(feedback)) {
      return Response.json({ error: "Faltan generationId o feedback inválido." }, { status: 400 });
    }

    await auth.supabase
      .from("ai_generations")
      .update({ user_feedback: feedback })
      .eq("id", generationId)
      .eq("user_id", auth.user.id);

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error saving AI feedback:", error);
    return Response.json({ error: "No se pudo guardar el feedback." }, { status: 500 });
  }
}
