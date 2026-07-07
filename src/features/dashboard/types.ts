export type EjercicioIA = {
  nombre: string;
  musculoObjetivo: string;
  equipamiento: "Polea" | "Barra" | "Máquina" | "Mancuerna" | "Corporal";
  seriesObjetivo: number;
  repeticionesObjetivo: string;
  notas: string;
};

export type RutinaIA = {
  titulo: string;
  descripcion: string;
  ejercicios: EjercicioIA[];
};

export type RutinaResponse = {
  rutinas: RutinaIA[];
};

export type EjercicioGuardado = {
  name: string;
  target_muscle: string;
  equipment: string;
};

export type RutinaExerciseGuardada = {
  target_sets: number | null;
  target_reps: string | null;
  notes: string | null;
  exercises?: EjercicioGuardado | EjercicioGuardado[] | null;
};

export type RutinaGuardada = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  routine_exercises?: RutinaExerciseGuardada[];
};

export type DashboardMetrics = {
  weeklyVolume: number;
  weeklySets: number;
  weeklyWorkouts: number;
  currentStreak: number;
  lastWorkoutLabel: string;
};

export type ActiveProgram = {
  id: string;
  name: string;
  duration_weeks: number;
  deload_every_n_weeks: number | null;
  currentWeek: number;
  nextWeekIsDeload: boolean;
};

export type CoachRecommendation = {
  id: string;
  category: "volume_low" | "volume_high" | "fatigue" | "adherence" | "general";
  severity: "info" | "warning" | "critical";
  message: string;
  is_read: boolean;
  created_at: string;
};

export const INITIAL_METRICS: DashboardMetrics = {
  weeklyVolume: 0,
  weeklySets: 0,
  weeklyWorkouts: 0,
  currentStreak: 0,
  lastWorkoutLabel: "Sin registros",
};
