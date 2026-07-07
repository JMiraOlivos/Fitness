import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getExerciseSessionHistory, resolveOptionalAuth } from '@/lib/supabaseServer';
import { logAiGeneration } from '@/lib/ai/logGeneration';

export const runtime = 'edge';

const apiKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GOOGLE_GENERATION_AI_API_KEY;

const insightSchema = z.object({
  insight: z.string().describe('Análisis breve del entrenamiento en español, máximo 2 frases.'),
  focoProximoEntrenamiento: z.string().describe('Recomendación concreta para la próxima sesión.'),
  alerta: z.string().describe('Advertencia breve si hay exceso de RPE, fatiga o bajo volumen. Si no aplica, decir "Sin alertas relevantes".'),
  score: z.number().min(1).max(10).describe('Score del entrenamiento de 1 a 10.'),
});

function fallbackInsight(payload: Record<string, unknown>) {
  const totalSets = Number(payload.totalSets || 0);
  const totalVolume = Number(payload.totalVolume || 0);
  const averageRpe = Number(payload.averageRpe || 0);

  return {
    insight: `Entrenamiento finalizado con ${totalSets} series y ${Math.round(totalVolume)} kg de volumen total${averageRpe ? `, con RPE promedio ${averageRpe.toFixed(1)}` : ''}.`,
    focoProximoEntrenamiento: 'Mantén la técnica estable y busca progresar de forma gradual en los ejercicios principales.',
    alerta: averageRpe >= 9 ? 'RPE alto: considera controlar la fatiga en la próxima sesión.' : 'Sin alertas relevantes',
    score: totalSets > 0 ? Math.min(10, Math.max(6, Math.round(totalSets / 2))) : 5,
  };
}

export async function POST(req: Request) {
  let auth: Awaited<ReturnType<typeof resolveOptionalAuth>> = null;
  const startedAt = Date.now();
  let payload: any = {};

  try {
    payload = await req.json();

    if (!apiKey) {
      return Response.json(fallbackInsight(payload));
    }

    const google = createGoogleGenerativeAI({ apiKey });

    // Best-effort: an anonymous or invalid-token caller still gets an insight from
    // just this session's numbers, matching the previous behavior.
    auth = await resolveOptionalAuth(req);
    const exerciseIds: string[] = Array.isArray(payload.exerciseSummaries)
      ? payload.exerciseSummaries.map((item: { exerciseId?: string }) => item.exerciseId).filter(Boolean)
      : [];

    const history = await getExerciseSessionHistory(auth, exerciseIds, payload.workoutLogId || null);

    const historialContext = Object.keys(history).length > 0
      ? `\nTendencia de sesiones anteriores por ejercicio (de más reciente a más antigua, no incluye la sesión de hoy):\n${Array.isArray(payload.exerciseSummaries)
          ? payload.exerciseSummaries
              .filter((item: { exerciseId?: string }) => item.exerciseId && history[item.exerciseId]?.length > 0)
              .map((item: { exerciseId: string; exerciseName: string }) => {
                const points = history[item.exerciseId]
                  .map(
                    (point) =>
                      `${Math.round(point.volume)}kg vol / ${point.maxWeight}kg máx${
                        point.averageRpe !== null ? ` / RPE ${point.averageRpe.toFixed(1)}` : ''
                      } (hace ${point.daysAgo}d)`
                  )
                  .join(' → ');
                return `- ${item.exerciseName}: ${points}`;
              })
              .join('\n')
          : ''}`
      : '';

    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: insightSchema,
      system: `Eres un coach de fuerza e hipertrofia. Entregas feedback práctico, breve y accionable.
      Debes analizar volumen, cantidad de series, RPE promedio y ejercicios registrados de la sesión de hoy.
      Cuando recibas la tendencia de sesiones anteriores por ejercicio, úsala para detectar fatiga o estancamiento real
      (volumen o peso bajando, o RPE subiendo sesión tras sesión) y para sugerir un deload cuando corresponda —
      no te limites a comentar solo la sesión de hoy si hay tendencia disponible.
      No des recomendaciones médicas. Si ves RPE muy alto, sugiere controlar fatiga.`,
      prompt: `Analiza este entrenamiento y devuelve un insight útil para el usuario:
      ${JSON.stringify(payload)}${historialContext}`,
    });

    await logAiGeneration({
      supabase: auth?.supabase ?? null,
      userId: auth?.user.id ?? null,
      type: 'workout_insight',
      input: payload,
      output: result.object,
      latencyMs: Date.now() - startedAt,
      success: true,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error('Error analizando entrenamiento con IA:', error);

    await logAiGeneration({
      supabase: auth?.supabase ?? null,
      userId: auth?.user.id ?? null,
      type: 'workout_insight',
      input: payload,
      output: null,
      latencyMs: Date.now() - startedAt,
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });

    return Response.json({ error: 'No se pudo generar el análisis del entrenamiento.' }, { status: 500 });
  }
}
