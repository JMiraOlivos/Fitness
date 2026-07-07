export type MetricSetLog = {
  weight: number | null;
  reps: number | null;
  is_warmup: boolean;
};

export type MetricWorkout = {
  id: string;
  start_time: string;
  end_time: string | null;
  set_logs?: MetricSetLog[];
};

export function getWorkingSets(setLogs?: MetricSetLog[]) {
  return (setLogs || []).filter((setLog) => !setLog.is_warmup);
}

export function getWorkoutVolume(setLogs?: MetricSetLog[]) {
  return getWorkingSets(setLogs).reduce((sum, setLog) => sum + Number(setLog.weight || 0) * Number(setLog.reps || 0), 0);
}

export function getLocalDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-CA");
}

export function calcularRacha(workouts: MetricWorkout[], referenceDate: Date = new Date()) {
  const dates = new Set(workouts.filter((workout) => workout.end_time).map((workout) => getLocalDateKey(workout.start_time)));
  let streak = 0;
  const cursor = new Date(referenceDate);

  while (dates.has(getLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function formatKg(value: number) {
  return new Intl.NumberFormat("es-CL").format(Math.round(value));
}

export function getLastWorkoutLabel(workouts: MetricWorkout[]) {
  if (workouts.length === 0) return "Sin registros";
  return new Date(workouts[0].start_time).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}
