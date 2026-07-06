import { getAuthenticatedClient } from "@/lib/supabaseServer";

export const runtime = "edge";

export async function POST(req: Request) {
  const auth = await getAuthenticatedClient(req);

  if ("error" in auth) {
    return Response.json({ error: "Inicia sesión para registrar series." }, { status: 401 });
  }

  const { workoutLogId, exerciseId, setNumber, weight, reps, rpe, isWarmup } = await req.json();

  if (!workoutLogId || !exerciseId) {
    return Response.json({ error: "Falta el entrenamiento o el ejercicio." }, { status: 400 });
  }

  if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0) {
    return Response.json({ error: "Ingresa un peso válido." }, { status: 400 });
  }

  if (typeof reps !== "number" || !Number.isFinite(reps) || reps <= 0) {
    return Response.json({ error: "Ingresa repeticiones válidas." }, { status: 400 });
  }

  if (rpe !== null && rpe !== undefined && (typeof rpe !== "number" || rpe < 1 || rpe > 10)) {
    return Response.json({ error: "El RPE debe estar entre 1 y 10." }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("set_logs")
    .insert({
      workout_log_id: workoutLogId,
      exercise_id: exerciseId,
      set_number: setNumber,
      weight,
      reps,
      rpe: rpe ?? null,
      is_warmup: Boolean(isWarmup),
    })
    .select("id, set_number, weight, reps, rpe, is_warmup")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
