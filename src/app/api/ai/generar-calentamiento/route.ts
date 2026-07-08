import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { logAiGeneration } from "@/lib/ai/logGeneration";
import { resolveOptionalAuth } from "@/lib/supabaseServer";

export const runtime = "edge";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GENERATION_AI_API_KEY;

const warmupSchema = z.object({
  calentamiento: z.array(
    z.object({
      nombre: z.string().describe("Nombre del ejercicio de calentamiento en español"),
      descripcion: z.string().describe("Instrucción breve: duración, reps, o cómo ejecutarlo"),
      duracionSegundos: z.number().default(60).describe("Duración estimada en segundos"),
      tipo: z.enum(["movilidad", "activacion", "aproximacion"]).describe("Tipo: movilidad articular, activación muscular, o serie de aproximación"),
    })
  ),
});

function fallbackWarmup(muscleGroups: string[]) {
  return {
    calentamiento: [
      { nombre: "Rotaciones de cadera", descripcion: "10 rotaciones por lado, círculos amplios", duracionSegundos: 60, tipo: "movilidad" as const },
      { nombre: "Círculos de brazos", descripcion: "10 hacia adelante y 10 hacia atrás", duracionSegundos: 45, tipo: "movilidad" as const },
      { nombre: "Sentadilla al aire", descripcion: "2 series de 10 reps, sin peso, rango completo", duracionSegundos: 60, tipo: "activacion" as const },
      { nombre: "Push-up inclinado", descripcion: "2 series de 8 reps, en banco o pared", duracionSegundos: 45, tipo: "activacion" as const },
    ],
  };
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  let payload: any = {};

  try {
    payload = await req.json();
    const muscleGroups: string[] = Array.isArray(payload.muscleGroups) ? payload.muscleGroups : [];

    if (!apiKey) {
      return Response.json(fallbackWarmup(muscleGroups));
    }

    const google = createGoogleGenerativeAI({ apiKey });
    const auth = await resolveOptionalAuth(req);

    const result = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: warmupSchema,
      system: `Eres un coach de fuerza e hipertrofia. Generas calentamientos breves y efectivos para el entrenamiento del día.
      Cada calentamiento debe incluir ejercicios de movilidad articular, activación muscular y si aplica, series de aproximación para los ejercicios principales.
      Adapta el calentamiento a los grupos musculares que se van a trabajar.
      Mantén las instrucciones en español, breves y accionables.`,
      prompt: `Genera un calentamiento de 4-5 ejercicios para un entrenamiento que trabaja estos grupos musculares: ${muscleGroups.join(", ") || "cuerpo completo"}.
      Incluye al menos un ejercicio de movilidad y uno de activación.`,
    });

    await logAiGeneration({
      supabase: auth?.supabase ?? null,
      userId: auth?.user.id ?? null,
      type: "routine_generation" as any,
      input: payload,
      output: result.object,
      latencyMs: Date.now() - startedAt,
      success: true,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error("Error generando calentamiento:", error);
    return Response.json(fallbackWarmup([]));
  }
}
