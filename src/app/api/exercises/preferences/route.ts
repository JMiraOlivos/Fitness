import { getAuthenticatedClient } from "@/lib/supabaseServer";

export const runtime = "edge";

export async function POST(req: Request) {
  const auth = await getAuthenticatedClient(req);

  if ("error" in auth) {
    return Response.json({ error: "Inicia sesión para gestionar preferencias." }, { status: 401 });
  }

  const { exerciseId, isFavorite, isAvoided } = await req.json();

  if (!exerciseId || typeof exerciseId !== "string") {
    return Response.json({ error: "Falta el ID del ejercicio." }, { status: 400 });
  }

  const patch: Record<string, boolean | null> = {};
  if (typeof isFavorite === "boolean") patch.is_favorite = isFavorite;
  if (typeof isAvoided === "boolean") patch.is_avoided = isAvoided;

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Envía isFavorite o isAvoided." }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("user_exercise_preferences")
    .upsert(
      {
        user_id: auth.user.id,
        exercise_id: exerciseId,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,exercise_id" }
    )
    .select("id, exercise_id, is_favorite, is_avoided")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
