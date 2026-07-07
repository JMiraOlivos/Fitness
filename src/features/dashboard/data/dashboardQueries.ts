import { supabase } from "@/lib/supabase";
import type { MetricWorkout } from "@/lib/dashboardMetrics";
import type { ActiveProgram, RutinaGuardada } from "../types";

export async function fetchProfilePreferences(userId: string) {
  const { data } = await supabase.from("profiles").select("training_goal, injury_notes").eq("id", userId).maybeSingle();
  return data;
}

export async function fetchActiveProgram(): Promise<ActiveProgram | null> {
  const { data: program } = await supabase
    .from("programs")
    .select("id, name, duration_weeks, deload_every_n_weeks")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!program) return null;

  const { data: weeks } = await supabase.from("routines").select("week_number").eq("program_id", program.id);

  const currentWeek = (weeks || []).reduce((max, row) => Math.max(max, row.week_number ?? 0), 0);
  const nextWeek = currentWeek + 1;
  const nextWeekIsDeload =
    program.deload_every_n_weeks != null && nextWeek <= program.duration_weeks && nextWeek % program.deload_every_n_weeks === 0;

  return { ...program, currentWeek, nextWeekIsDeload };
}

export async function fetchSavedRoutines() {
  const { data, error } = await supabase
    .from("routines")
    .select(`
      id,
      title,
      description,
      created_at,
      routine_exercises (
        target_sets,
        target_reps,
        notes,
        exercises (
          name,
          target_muscle,
          equipment
        )
      )
    `)
    .order("created_at", { ascending: false })
    .limit(10);

  return { data: (data || []) as unknown as RutinaGuardada[], error };
}

export async function fetchRecentWorkouts() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from("workout_logs")
    .select(`
      id,
      start_time,
      end_time,
      set_logs (
        weight,
        reps,
        is_warmup
      )
    `)
    .gte("start_time", thirtyDaysAgo.toISOString())
    .order("start_time", { ascending: false });

  return { data: (data || []) as unknown as MetricWorkout[], error };
}
