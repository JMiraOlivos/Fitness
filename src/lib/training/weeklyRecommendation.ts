// Composes the "qué ajustar esta semana" card (ROADMAP.md, Fase vNext 7) from
// already-classified signals — no rule-deciding here, just assembling the
// concrete, human-readable lines out of volumeTargets/fatigue results.
export type WeeklyRecommendationInput = {
  lowVolumeMuscleGroups: string[];
  highVolumeMuscleGroups: string[];
  fatiguedExerciseNames: string[];
  adherence: { planned: number; completed: number } | null;
};

export function buildWeeklyRecommendations(input: WeeklyRecommendationInput): string[] {
  const recommendations: string[] = [];

  if (input.lowVolumeMuscleGroups.length > 0) {
    recommendations.push(`Volumen bajo en ${input.lowVolumeMuscleGroups.join(", ")}: agrega 1-2 series o un ejercicio esta semana.`);
  }

  if (input.highVolumeMuscleGroups.length > 0) {
    recommendations.push(`Volumen alto en ${input.highVolumeMuscleGroups.join(", ")}: puedes recortar 2-4 series sin perder progreso.`);
  }

  if (input.fatiguedExerciseNames.length > 0) {
    recommendations.push(`Señales de fatiga en ${input.fatiguedExerciseNames.join(", ")}: baja la carga o suma un día extra de descanso.`);
  }

  if (input.adherence && input.adherence.completed < input.adherence.planned) {
    recommendations.push(
      `Completaste ${input.adherence.completed}/${input.adherence.planned} entrenamientos planeados esta semana: prioriza no saltarte el próximo.`
    );
  }

  return recommendations;
}
