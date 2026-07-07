import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { EQUIPMENT_TYPES, MUSCLE_GROUPS } from '@/lib/exerciseTaxonomy';
import { EXERCISE_PRIORITIES, MOVEMENT_PATTERNS } from '@/lib/training/prescriptionTaxonomy';
import { MESOCYCLE_PHASE_TARGETS, type MesocyclePhase } from '@/lib/training/mesocycle';
import { getOptionalUserProfile, getRecentPerformanceSummary, resolveOptionalAuth } from '@/lib/supabaseServer';
import { logAiGeneration } from '@/lib/ai/logGeneration';

export const runtime = 'edge';

const apiKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GOOGLE_GENERATION_AI_API_KEY;

const rutinaSchema = z.object({
  rutinas: z.array(
    z.object({
      titulo: z.string().describe('Ej: Día 1: Upper enfocado en Poleas'),
      descripcion: z.string().describe('Breve explicación del objetivo del día'),
      ejercicios: z.array(
        z.object({
          nombre: z.string().describe('Nombre del ejercicio en español'),
          musculoObjetivo: z.enum(MUSCLE_GROUPS),
          equipamiento: z.enum(EQUIPMENT_TYPES),
          seriesObjetivo: z.number().default(3),
          repeticionesObjetivo: z.string().describe('Rango de reps, ej: "8-10" o "12-15"'),
          notas: z.string().describe('Consejo técnico de ejecución para este ejercicio'),
          descansoSegundos: z.number().min(30).max(600).describe('Descanso recomendado en segundos entre series'),
          rpeObjetivo: z.number().min(1).max(10).describe('RPE objetivo para las series de trabajo (1-10)'),
          rirObjetivo: z.number().min(0).max(5).describe('RIR objetivo equivalente (0-5)'),
          tempo: z.string().describe('Tempo de ejecución "excéntrico-pausa-concéntrico", ej: "3-1-1"'),
          patronMovimiento: z.enum(MOVEMENT_PATTERNS).describe('Patrón de movimiento principal del ejercicio'),
          prioridad: z.enum(EXERCISE_PRIORITIES).describe('Rol del ejercicio dentro de la sesión'),
          reglaProgresion: z
            .string()
            .describe('Regla concreta y accionable para progresar la próxima vez que se repita este ejercicio'),
          criterioSustitucion: z
            .string()
            .describe('Cuándo y por qué sustituir este ejercicio (ej: dolor, falta de equipo)'),
        })
      ),
    })
  ),
});

export async function POST(req: Request) {
  let auth: Awaited<ReturnType<typeof resolveOptionalAuth>> = null;
  let requestBody: unknown = null;
  const startedAt = Date.now();

  try {
    if (!apiKey) {
      return Response.json(
        {
          error: 'Falta configurar GOOGLE_GENERATIVE_AI_API_KEY en las variables de entorno de Vercel.',
        },
        { status: 500 }
      );
    }

    const {
      restricciones = 'Sin restricciones',
      diasDisponibles = 4,
      enfoque = 'Hipertrofia',
      programaContexto,
    }: {
      restricciones?: string;
      diasDisponibles?: number;
      enfoque?: string;
      programaContexto?: {
        nombre: string;
        semanaActual: number;
        semanasTotales: number;
        fase: MesocyclePhase;
      };
    } = await req.json();
    requestBody = { restricciones, diasDisponibles, enfoque, programaContexto };
    const google = createGoogleGenerativeAI({ apiKey });

    // Best-effort: an anonymous or invalid-token caller still gets a routine generated
    // exactly as before, just without profile/history personalization.
    auth = await resolveOptionalAuth(req);
    const profile = await getOptionalUserProfile(auth);
    const recentPerformance = await getRecentPerformanceSummary(auth);

    const restriccionesCompletas = profile?.injury_notes
      ? `${restricciones}. Restricciones persistentes del perfil del usuario (siempre aplican, aunque no se repitan arriba): ${profile.injury_notes}`
      : restricciones;

    const perfilContext = profile
      ? [
          profile.training_goal ? `- Objetivo declarado en su perfil: ${profile.training_goal}` : null,
          profile.experience_level ? `- Nivel de experiencia: ${profile.experience_level}` : null,
          profile.equipment_available ? `- Equipo disponible: ${profile.equipment_available}` : null,
        ]
          .filter(Boolean)
          .join('\n      ')
      : '';

    const historialContext =
      recentPerformance.length > 0
        ? `\n      Historial reciente de desempeño real del usuario (usa esto para aplicar sobrecarga progresiva: si el RPE fue bajo, sugiere subir peso o reps para ese ejercicio si lo repites; si fue alto, mantén o baja la carga):\n      ${recentPerformance
            .map(
              (item) =>
                `- ${item.exerciseName} (${item.targetMuscle}): ${item.weight}kg x ${item.reps} reps${
                  item.rpe !== null ? `, RPE ${item.rpe}` : ''
                }, hace ${item.daysAgo} día(s)`
            )
            .join('\n      ')}`
        : '';

    const programaContextoTexto = programaContexto
      ? `\n      Este día es parte del mesociclo "${programaContexto.nombre}", semana ${programaContexto.semanaActual} de ${
          programaContexto.semanasTotales
        } (fase: ${MESOCYCLE_PHASE_TARGETS[programaContexto.fase].label}). ${
          MESOCYCLE_PHASE_TARGETS[programaContexto.fase].instruction
        } Manteniendo los mismos patrones de movimiento/grupos musculares que correspondan a este enfoque.`
      : '';

    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      system: `Eres un entrenador personal experto y científico del deporte.
      Tu tarea es diseñar una rutina de entrenamiento personalizada basada en las restricciones del usuario.
      IMPORTANTE: Sigue estrictamente las restricciones o lesiones que el usuario indique en su solicitud.
      Si recibes el historial reciente de desempeño del usuario, aplica principios reales de sobrecarga progresiva
      en vez de generar pesos/reps genéricos.
      Para cada ejercicio debes entregar siempre, además de series/reps/notas: descanso en segundos,
      RPE objetivo, RIR objetivo, tempo, patrón de movimiento, prioridad dentro de la sesión
      (principal/accesorio/aislamiento/correctivo), una regla concreta para progresar la próxima vez,
      y un criterio de sustitución si el usuario siente molestia o no tiene el equipo.`,
      prompt: `Genera una rutina de entrenamiento con las siguientes especificaciones actuales:
      - Días disponibles esta semana: ${diasDisponibles}
      - Enfoque del entrenamiento: ${enfoque}
      - Restricciones o lesiones actuales: ${restriccionesCompletas}${perfilContext ? `\n      ${perfilContext}` : ''}${historialContext}${programaContextoTexto}`,
      schema: rutinaSchema,
    });

    await logAiGeneration({
      supabase: auth?.supabase ?? null,
      userId: auth?.user.id ?? null,
      type: 'routine_generation',
      input: requestBody,
      output: result.object,
      latencyMs: Date.now() - startedAt,
      success: true,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error('Error generando la rutina con Gemini:', error);

    await logAiGeneration({
      supabase: auth?.supabase ?? null,
      userId: auth?.user.id ?? null,
      type: 'routine_generation',
      input: requestBody,
      output: null,
      latencyMs: Date.now() - startedAt,
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });

    return Response.json({ error: 'Fallo al procesar la solicitud de IA' }, { status: 500 });
  }
}
