import { getAuthenticatedClient } from "@/lib/supabaseServer";
import { classifyVolume } from "@/lib/training/volumeTargets";
import { detectFatigue } from "@/lib/training/fatigue";
import { buildWeeklyRecommendations } from "@/lib/training/weeklyRecommendation";

export const runtime = "edge";

function categoryFromIndex(index: number) {
  const categories = ["volume_low", "volume_high", "fatigue", "adherence", "general"] as const;
  return categories[index] ?? "general";
}

function severityFromIndex(index: number): "info" | "warning" | "critical" {
  const severities = ["warning", "warning", "critical", "info", "info"] as const;
  return severities[index] ?? "info";
}

export async function POST(req: Request) {
  const auth = await getAuthenticatedClient(req);

  if ("error" in auth) {
    return Response.json({ error: "Inicia sesión para generar recomendaciones." }, { status: 401 });
  }

  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Volume per muscle group (last 7 days)
    const { data: setLogs } = await auth.supabase
      .from("set_logs")
      .select(`
        weight,
        reps,
        is_warmup,
        workout_logs!inner ( start_time ),
        exercises!inner ( target_muscle )
      `)
      .gte("workout_logs.start_time", sevenDaysAgo.toISOString())
      .eq("is_warmup", false);

    const muscleGroupSets = new Map<string, number>();
    const muscleGroupVolume = new Map<string, number>();

    if (setLogs) {
      for (const row of setLogs) {
        const exercises = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
        const muscle = exercises?.target_muscle;
        if (!muscle) continue;

        muscleGroupSets.set(muscle, (muscleGroupSets.get(muscle) ?? 0) + 1);
        muscleGroupVolume.set(
          muscle,
          (muscleGroupVolume.get(muscle) ?? 0) + Number(row.weight ?? 0) * Number(row.reps ?? 0)
        );
      }
    }

    const lowVolumeGroups: string[] = [];
    const highVolumeGroups: string[] = [];

    for (const [muscle, sets] of muscleGroupSets) {
      const status = classifyVolume(muscle, sets);
      if (status === "bajo") lowVolumeGroups.push(muscle);
      if (status === "alto") highVolumeGroups.push(muscle);
    }

    // Fatigue detection (last 90 days, per exercise)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: fatigueData } = await auth.supabase
      .from("set_logs")
      .select(`
        exercise_id,
        weight,
        reps,
        rpe,
        is_warmup,
        workout_log_id,
        workout_logs!inner ( start_time ),
        exercises!inner ( name )
      `)
      .gte("workout_logs.start_time", ninetyDaysAgo.toISOString())
      .eq("is_warmup", false);

    type MutableSession = { date: string; volume: number; averageRpe: number | null; rpeSum: number; rpeCount: number };
    const sessionsByExercise = new Map<string, { name: string; sessions: Map<string, MutableSession> }>();
    const fatiguedExerciseNames: string[] = [];

    if (fatigueData) {
      for (const row of fatigueData) {
        const exercises = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
        const workouts = Array.isArray(row.workout_logs) ? row.workout_logs[0] : row.workout_logs;

        if (!exercises?.name || !workouts?.start_time) continue;

        const entry = sessionsByExercise.get(row.exercise_id) ?? { name: exercises.name, sessions: new Map() };

        const session = entry.sessions.get(row.workout_log_id) ?? {
          date: workouts.start_time,
          volume: 0,
          averageRpe: null,
          rpeSum: 0,
          rpeCount: 0,
        };

        session.volume += Number(row.weight ?? 0) * Number(row.reps ?? 0);
        if (row.rpe !== null) {
          session.rpeSum += Number(row.rpe);
          session.rpeCount += 1;
          session.averageRpe = session.rpeSum / session.rpeCount;
        }

        entry.sessions.set(row.workout_log_id, session);
        sessionsByExercise.set(row.exercise_id, entry);
      }

      for (const [, entry] of sessionsByExercise) {
        const ordered = Array.from(entry.sessions.values())
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .map((s) => ({ volume: s.volume, averageRpe: s.averageRpe }));
        const { isFatigued } = detectFatigue(ordered);
        if (isFatigued) fatiguedExerciseNames.push(entry.name);
      }
    }

    // Adherence
    const { data: program } = await auth.supabase
      .from("programs")
      .select("days_per_week")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let adherence: { planned: number; completed: number } | null = null;
    if (program) {
      const { count } = await auth.supabase
        .from("workout_logs")
        .select("id", { count: "exact", head: true })
        .not("end_time", "is", null)
        .gte("start_time", sevenDaysAgo.toISOString());
      adherence = { planned: program.days_per_week, completed: count ?? 0 };
    }

    const recommendations = buildWeeklyRecommendations({
      lowVolumeMuscleGroups: lowVolumeGroups,
      highVolumeMuscleGroups: highVolumeGroups,
      fatiguedExerciseNames,
      adherence,
    });

    if (recommendations.length === 0) {
      return Response.json({ recommendations: [] });
    }

    // Persist new recommendations — dedup by (user_id, category, message).
    // is_read = false so they show as unread in the Home.
    const inserts = recommendations.map((message, index) => ({
      user_id: auth.user.id,
      category: categoryFromIndex(index),
      severity: severityFromIndex(index),
      message,
    }));

    await auth.supabase.from("coach_recommendations").insert(inserts);

    return Response.json({ recommendations });
  } catch (error) {
    console.error("Error generating coach recommendations:", error);
    return Response.json({ error: "No se pudieron generar las recomendaciones." }, { status: 500 });
  }
}
