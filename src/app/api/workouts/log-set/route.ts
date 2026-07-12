import { getAuthenticatedClient } from "@/lib/supabaseServer";

export const runtime = "edge";

export async function POST(req: Request) {
  const auth = await getAuthenticatedClient(req);

  if ("error" in auth) {
    return Response.json({ error: "Inicia sesión para registrar series." }, { status: 401 });
  }

  const { workoutLogId, exerciseId, setNumber, weight, reps, rpe, rir, side, tempoSeconds, isWarmup, clientOperationId } = await req.json();

  if (!workoutLogId || !exerciseId) {
    return Response.json({ error: "Falta el entrenamiento o el ejercicio." }, { status: 400 });
  }

  if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0) {
    return Response.json({ error: "Ingresa un peso válido." }, { status: 400 });
  }

  if (typeof reps !== "number" || !Number.isFinite(reps) || reps <= 0) {
    return Response.json({ error: "Ingresa repeticiones válidas." }, { status: 400 });
  }

  if (
    rpe !== null &&
    rpe !== undefined &&
    (typeof rpe !== "number" || rpe < 1 || rpe > 10 || Math.round(rpe * 2) !== rpe * 2)
  ) {
    return Response.json({ error: "El RPE debe estar entre 1 y 10, en incrementos de 0.5." }, { status: 400 });
  }

  if (rir !== null && rir !== undefined && (typeof rir !== "number" || rir < 0 || rir > 5)) {
    return Response.json({ error: "El RIR debe estar entre 0 y 5." }, { status: 400 });
  }

  if (side !== null && side !== undefined && !["both", "left", "right"].includes(side)) {
    return Response.json({ error: "Lado inválido." }, { status: 400 });
  }

  if (tempoSeconds !== null && tempoSeconds !== undefined && (typeof tempoSeconds !== "number" || tempoSeconds < 1 || tempoSeconds > 600)) {
    return Response.json({ error: "El tiempo bajo tensión debe estar entre 1 y 600 segundos." }, { status: 400 });
  }

  const setSelect = "id, set_number, weight, reps, rpe, rir, side, tempo_seconds, is_warmup";

  if (clientOperationId) {
    const { data: existing } = await auth.supabase
      .from("set_logs")
      .select(setSelect)
      .eq("client_operation_id", clientOperationId)
      .maybeSingle();

    if (existing) {
      return Response.json(existing);
    }
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
      rir: rir ?? null,
      side: side ?? null,
      tempo_seconds: tempoSeconds ?? null,
      is_warmup: Boolean(isWarmup),
      client_operation_id: clientOperationId ?? null,
    })
    .select(setSelect)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}
