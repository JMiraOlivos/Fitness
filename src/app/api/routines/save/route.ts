import { getAuthenticatedClient } from "@/lib/supabaseServer";

export const runtime = "edge";

export async function POST(req: Request) {
  const auth = await getAuthenticatedClient(req);

  if ("error" in auth) {
    return Response.json({ error: "Inicia sesión para guardar rutinas." }, { status: 401 });
  }

  const { rutina } = await req.json();

  if (!rutina || typeof rutina !== "object") {
    return Response.json({ error: "Payload de rutina inválido." }, { status: 400 });
  }

  const { data, error } = await auth.supabase.rpc("save_ai_routine", { p_routine: rutina });

  if (error) {
    console.error("Error guardando rutina vía RPC:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ id: data });
}
