import { getAuthenticatedClient } from "@/lib/supabaseServer";

export const runtime = "edge";

export async function POST(req: Request) {
  const auth = await getAuthenticatedClient(req);

  if ("error" in auth) {
    return Response.json({ error: "Inicia sesión para registrar entrenamientos." }, { status: 401 });
  }

  const { routineId } = await req.json();

  const { data, error } = await auth.supabase
    .from("workout_logs")
    .insert({
      user_id: auth.user.id,
      routine_id: routineId ?? null,
    })
    .select("id, start_time")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ id: data.id, startTime: data.start_time });
}
