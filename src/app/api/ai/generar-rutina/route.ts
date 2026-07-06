import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { EQUIPMENT_TYPES, MUSCLE_GROUPS } from '@/lib/exerciseTaxonomy';
import { getOptionalUserProfile } from '@/lib/supabaseServer';

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

    // Best-effort: an anonymous or invalid-token caller still gets a routine generated
    // exactly as before, just without profile personalization.
    const profile = await getOptionalUserProfile(req);

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

    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      system: `Eres un entrenador personal experto y científico del deporte.
      Tu tarea es diseñar una rutina de entrenamiento personalizada basada en las restricciones del usuario.
      IMPORTANTE: Sigue estrictamente las restricciones o lesiones que el usuario indique en su solicitud.`,
      prompt: `Genera una rutina de entrenamiento con las siguientes especificaciones actuales:
      - Días disponibles esta semana: ${diasDisponibles}
      - Enfoque del entrenamiento: ${enfoque}
      - Restricciones o lesiones actuales: ${restriccionesCompletas}${perfilContext ? `\n      ${perfilContext}` : ''}`,
      schema: rutinaSchema,
    });

    return Response.json(result.object);
  } catch (error) {
    console.error('Error generando la rutina con Gemini:', error);
    return Response.json({ error: 'Fallo al procesar la solicitud de IA' }, { status: 500 });
  }
}
