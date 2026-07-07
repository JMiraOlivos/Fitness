import { getAuthenticatedClient } from "@/lib/supabaseServer";

export const runtime = "edge";

export async function POST(req: Request) {
  const auth = await getAuthenticatedClient(req);

  if ("error" in auth) {
    return Response.json({ error: "Inicia sesión para registrar entrenamientos." }, { status: 401 });
  }

  const { routineId, clientOperationId } = await req.json();

  if (clientOperationId) {
    const { data: existing } = await auth.supabase
      .from("workout_logs")
      .select("id, start_time")
      .eq("client_operation_id", clientOperationId)
      .maybeSingle();

    if (existing) {
      return Response.json({ id: existing.id, startTime: existing.start_time });
    }
  }

  const { data, error } = await auth.supabase
    .from("workout_logs")
    .insert({
      user_id: auth.user.id,
      routine_id: routineId ?? null,
      client_operation_id: clientOperationId ?? null,
    })
    .select("id, start_time")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ id: data.id, startTime: data.start_time });
}
