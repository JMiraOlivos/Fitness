import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { EQUIPMENT_TYPES, MUSCLE_GROUPS } from "@/lib/exerciseTaxonomy";
import { getAuthenticatedClient, getOptionalUserProfile, getRecentPerformanceSummary } from "@/lib/supabaseServer";

export const runtime = "edge";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GENERATION_AI_API_KEY;

const diaSchema = z.object({
  titulo: z.string().describe("Ej: Día 1: Upper enfocado en Poleas"),
  descripcion: z.string().describe("Breve explicación del objetivo del día"),
  ejercicios: z.array(
    z.object({
      nombre: z.string().describe("Nombre del ejercicio en español"),
      musculoObjetivo: z.enum(MUSCLE_GROUPS),
      equipamiento: z.enum(EQUIPMENT_TYPES),
      seriesObjetivo: z.number().default(3),
      repeticionesObjetivo: z.string().describe('Rango de reps, ej: "8-10" o "12-15"'),
      notas: z.string().describe("Consejo técnico de ejecución para este ejercicio"),
    })
  ),
});

type RoutineExerciseRow = {
  target_sets: number | null;
  target_reps: string | null;
  exercises: { name: string; target_muscle: string } | { name: string; target_muscle: string }[] | null;
};

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      return Response.json({ error: "Falta configurar GOOGLE_GENERATIVE_AI_API_KEY en las variables de entorno de Vercel." }, { status: 500 });
    }

    const auth = await getAuthenticatedClient(req);

    if ("error" in auth) {
      return Response.json({ error: "Inicia sesión para regenerar una rutina." }, { status: 401 });
    }

    const { routineId, instrucciones = "" } = await req.json();

    if (!routineId || typeof routineId !== "string") {
      return Response.json({ error: "Falta el ID de la rutina." }, { status: 400 });
    }

    const { data: routine, error: routineError } = await auth.supabase
      .from("routines")
      .select(
        "id, title, description, is_deload_week, routine_exercises ( target_sets, target_reps, exercises ( name, target_muscle ) )"
      )
      .eq("id", routineId)
      .maybeSingle();

    if (routineError) {
      return Response.json({ error: routineError.message }, { status: 500 });
    }

    if (!routine) {
      return Response.json({ error: "Rutina no encontrada." }, { status: 404 });
    }

    const currentExercises = ((routine.routine_exercises as RoutineExerciseRow[] | null) || []).map((item) => {
      const exercise = Array.isArray(item.exercises) ? item.exercises[0] : item.exercises;
      return `${exercise?.name || "Ejercicio"} (${exercise?.target_muscle || ""}) — ${item.target_sets || 3}x${item.target_reps || "10-12"}`;
    });

    const profile = await getOptionalUserProfile(auth);
    const recentPerformance = await getRecentPerformanceSummary(auth);

    const restriccionesCompletas = profile?.injury_notes
      ? `Restricciones persistentes del perfil del usuario (siempre aplican): ${profile.injury_notes}`
      : "Sin restricciones adicionales.";

    const perfilContext = profile
      ? [
          profile.training_goal ? `- Objetivo declarado en su perfil: ${profile.training_goal}` : null,
          profile.experience_level ? `- Nivel de experiencia: ${profile.experience_level}` : null,
          profile.equipment_available ? `- Equipo disponible: ${profile.equipment_available}` : null,
        ]
          .filter(Boolean)
          .join("\n      ")
      : "";

    const historialContext =
      recentPerformance.length > 0
        ? `\n      Historial reciente de desempeño real del usuario (usa esto para aplicar sobrecarga progresiva):\n      ${recentPerformance
            .map(
              (item) =>
                `- ${item.exerciseName} (${item.targetMuscle}): ${item.weight}kg x ${item.reps} reps${item.rpe !== null ? `, RPE ${item.rpe}` : ""}, hace ${item.daysAgo} día(s)`
            )
            .join("\n      ")}`
        : "";

    const deloadContext = routine.is_deload_week
      ? "\n      Este día pertenece a una SEMANA DE DESCARGA (deload) del mesociclo: reduce el volumen (series por ejercicio) en 40-50% y baja la intensidad sugerida en las notas de cada ejercicio, manteniendo los mismos patrones de movimiento/grupos musculares."
      : "";

    const google = createGoogleGenerativeAI({ apiKey });

    const result = await generateObject({
      model: google("gemini-2.5-flash"),
      system: `Eres un entrenador personal experto y científico del deporte.
      Tu tarea es regenerar UN SOLO día de una rutina de entrenamiento ya existente, manteniendo el mismo enfoque
      general del día (grupo muscular / tipo de entrenamiento) salvo que el usuario pida explícitamente lo contrario.
      IMPORTANTE: Sigue estrictamente cualquier restricción o lesión que el usuario indique.`,
      prompt: `Este es el día actual que hay que regenerar:
      - Título actual: ${routine.title}
      - Descripción actual: ${routine.description || "Sin descripción"}
      - Ejercicios actuales: ${currentExercises.join(", ") || "Ninguno registrado"}

      Instrucciones del usuario para esta regeneración: ${instrucciones || "Ninguna, propone una variante distinta pero con el mismo enfoque."}
      ${restriccionesCompletas}${perfilContext ? `\n      ${perfilContext}` : ""}${historialContext}${deloadContext}

      Genera un nuevo título, descripción y lista de ejercicios para este día.`,
      schema: diaSchema,
    });

    const { error: regenerateError } = await auth.supabase.rpc("regenerate_ai_routine_day", {
      p_routine_id: routineId,
      p_routine: result.object,
    });

    if (regenerateError) {
      console.error("Error regenerando rutina vía RPC:", regenerateError);
      return Response.json({ error: regenerateError.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("Error regenerando el día con Gemini:", error);
    return Response.json({ error: "Fallo al procesar la solicitud de IA" }, { status: 500 });
  }
}
