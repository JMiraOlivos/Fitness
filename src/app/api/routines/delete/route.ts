import { getAuthenticatedClient } from "@/lib/supabaseServer";

export const runtime = "edge";

export async function POST(req: Request) {
  const auth = await getAuthenticatedClient(req);

  if ("error" in auth) {
    return Response.json({ error: "Inicia sesión para borrar rutinas." }, { status: 401 });
  }

  const { routineId } = await req.json();

  if (!routineId || typeof routineId !== "string") {
    return Response.json({ error: "Falta el ID de la rutina." }, { status: 400 });
  }

  // RLS ("Users can delete own routines") scopes this to the caller's own rows —
  // deleting someone else's routine id here just affects zero rows, not an error.
  const { error, count } = await auth.supabase.from("routines").delete({ count: "exact" }).eq("id", routineId);

  if (error) {
    console.error("Error borrando rutina:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (!count) {
    return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
