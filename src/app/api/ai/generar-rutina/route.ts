import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

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
          musculoObjetivo: z.string().describe('Pecho, Dorsal, Hombro, Cuádriceps, Isquios, etc.'),
          equipamiento: z.enum(['Polea', 'Barra', 'Máquina', 'Mancuerna', 'Corporal']),
          seriesObjetivo: z.number().default(3),
          repeticionesObjetivo: z.string().describe('Rango de reps, ej: "8-10" o "12-15"'),
          notas: z.string().describe('Consejo técnico de ejecución para este ejercicio'),
        })
      ),
    })
  ),
});

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      return Response.json(
        {
          error: 'Falta configurar GOOGLE_GENERATIVE_AI_API_KEY en las variables de entorno de Vercel.',
        },
        { status: 500 }
      );
    }

    const { restricciones = 'Sin restricciones', diasDisponibles = 4, enfoque = 'Hipertrofia' } = await req.json();
    const google = createGoogleGenerativeAI({ apiKey });

    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      system: `Eres un entrenador personal experto y científico del deporte.
      Tu tarea es diseñar una rutina de entrenamiento personalizada basada en las restricciones del usuario.
      IMPORTANTE: Sigue estrictamente las preferencias históricas del usuario:
      - NO incluyas pullups, dominadas ni variantes libres de colgarse. Usa solo jalón al pecho o remo en máquina.
      - NO incluyas sentadillas búlgaras.
      - Para el tren superior (upper), prioriza ejercicios con poleas, press de banca libre y press de hombros en máquina.`,
      prompt: `Genera una rutina de entrenamiento con las siguientes especificaciones actuales:
      - Días disponibles esta semana: ${diasDisponibles}
      - Enfoque del entrenamiento: ${enfoque}
      - Restricciones o lesiones actuales: ${restricciones}`,
      schema: rutinaSchema,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error('Error generando la rutina con Gemini:', error);
    return Response.json({ error: 'Fallo al procesar la solicitud de IA' }, { status: 500 });
  }
}
