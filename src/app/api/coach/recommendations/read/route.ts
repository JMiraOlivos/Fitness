import { getAuthenticatedClient } from "@/lib/supabaseServer";

export const runtime = "edge";

export async function POST(req: Request) {
  const auth = await getAuthenticatedClient(req);

  if ("error" in auth) {
    return Response.json({ error: "Inicia sesión para actualizar recomendaciones." }, { status: 401 });
  }

  try {
    const { recommendationId, markAll } = await req.json();

    if (markAll) {
      await auth.supabase
        .from("coach_recommendations")
        .update({ is_read: true })
        .eq("user_id", auth.user.id)
        .eq("is_read", false);
    } else if (recommendationId) {
      await auth.supabase
        .from("coach_recommendations")
        .update({ is_read: true })
        .eq("id", recommendationId)
        .eq("user_id", auth.user.id);
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error marking recommendations as read:", error);
    return Response.json({ error: "No se pudo actualizar la recomendación." }, { status: 500 });
  }
}
