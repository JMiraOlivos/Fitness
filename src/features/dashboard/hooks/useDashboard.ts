import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { calcularRacha, getLastWorkoutLabel, getWorkingSets, getWorkoutVolume } from "@/lib/dashboardMetrics";
import { fetchActiveProgram, fetchProfilePreferences, fetchRecentWorkouts, fetchSavedRoutines } from "../data/dashboardQueries";
import { deleteRoutine, generateRoutine, saveRoutine, signOut } from "../data/dashboardMutations";
import { INITIAL_METRICS, type ActiveProgram, type DashboardMetrics, type RutinaGuardada, type RutinaIA } from "../types";

export function useDashboard() {
  const { user, isLoading: isSessionLoading } = useSession();

  const [diasDisponibles, setDiasDisponibles] = useState("4");
  const [enfoque, setEnfoque] = useState("Hipertrofia upper/lower");
  const [restricciones, setRestricciones] = useState("");
  const [rutinasIA, setRutinasIA] = useState<RutinaIA[]>([]);
  const [rutinasGuardadas, setRutinasGuardadas] = useState<RutinaGuardada[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>(INITIAL_METRICS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeProgram, setActiveProgram] = useState<ActiveProgram | null>(null);

  const cargarRutinasGuardadas = useCallback(async () => {
    setIsLoadingSaved(true);
    const { data, error: loadError } = await fetchSavedRoutines();
    if (loadError) setError(loadError.message);
    else setRutinasGuardadas(data);
    setIsLoadingSaved(false);
  }, []);

  const cargarMetricasDashboard = useCallback(async () => {
    setIsLoadingMetrics(true);

    const { data: workouts, error: metricsError } = await fetchRecentWorkouts();

    if (metricsError) {
      setError(metricsError.message);
      setIsLoadingMetrics(false);
      return;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weeklyWorkouts = workouts.filter((workout) => new Date(workout.start_time) >= sevenDaysAgo);
    const completedWeeklyWorkouts = weeklyWorkouts.filter((workout) => workout.end_time);
    const weeklyVolume = weeklyWorkouts.reduce((sum, workout) => sum + getWorkoutVolume(workout.set_logs), 0);
    const weeklySets = weeklyWorkouts.reduce((sum, workout) => sum + getWorkingSets(workout.set_logs).length, 0);

    setMetrics({
      weeklyVolume,
      weeklySets,
      weeklyWorkouts: completedWeeklyWorkouts.length,
      currentStreak: calcularRacha(workouts),
      lastWorkoutLabel: getLastWorkoutLabel(workouts),
    });

    setIsLoadingMetrics(false);
  }, []);

  const precargarPerfil = useCallback(async () => {
    if (!user) return;

    const profile = await fetchProfilePreferences(user.id);
    if (!profile) return;

    if (profile.training_goal) setEnfoque(profile.training_goal);
    if (profile.injury_notes) setRestricciones(profile.injury_notes);
  }, [user]);

  const cargarProgramaActivo = useCallback(async () => {
    setActiveProgram(await fetchActiveProgram());
  }, []);

  useEffect(() => {
    if (isSessionLoading) return;

    if (user) {
      void cargarRutinasGuardadas();
      void cargarMetricasDashboard();
      void precargarPerfil();
      void cargarProgramaActivo();
    } else {
      setRutinasGuardadas([]);
      setMetrics(INITIAL_METRICS);
      setActiveProgram(null);
    }
  }, [user, isSessionLoading, cargarRutinasGuardadas, cargarMetricasDashboard, precargarPerfil, cargarProgramaActivo]);

  async function cerrarSesion() {
    await signOut();
    setRutinasGuardadas([]);
    setMetrics(INITIAL_METRICS);
  }

  async function generarRutina() {
    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const rutinas = await generateRoutine({ diasDisponibles: Number(diasDisponibles), enfoque, restricciones });
      setRutinasIA(rutinas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function guardarRutina(rutina: RutinaIA) {
    setError(null);
    setSuccessMessage(null);

    if (!user) {
      setError("Inicia sesión para guardar rutinas en Supabase.");
      return;
    }

    setIsSaving(true);

    try {
      await saveRoutine(rutina);
      setSuccessMessage(`Rutina "${rutina.titulo}" guardada.`);
      await cargarRutinasGuardadas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la rutina.");
    } finally {
      setIsSaving(false);
    }
  }

  async function borrarRutina(rutina: RutinaGuardada) {
    setError(null);
    setSuccessMessage(null);
    setIsDeleting(true);

    try {
      await deleteRoutine(rutina.id);
      setRutinasGuardadas((current) => current.filter((item) => item.id !== rutina.id));
      setSuccessMessage(`Rutina "${rutina.title}" borrada.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar la rutina.");
    } finally {
      setIsDeleting(false);
      setConfirmingDeleteId(null);
    }
  }

  return {
    user,
    diasDisponibles,
    setDiasDisponibles,
    enfoque,
    setEnfoque,
    restricciones,
    setRestricciones,
    rutinasIA,
    rutinasGuardadas,
    metrics,
    isGenerating,
    isSaving,
    isLoadingSaved,
    isLoadingMetrics,
    successMessage,
    error,
    confirmingDeleteId,
    setConfirmingDeleteId,
    isDeleting,
    activeProgram,
    cerrarSesion,
    generarRutina,
    guardarRutina,
    borrarRutina,
    cargarRutinasGuardadas,
  };
}

export type Dashboard = ReturnType<typeof useDashboard>;
