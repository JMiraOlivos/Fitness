"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { BrainCircuit, CheckCircle2, Dumbbell, History, Loader2, LogOut, Play, Plus, Save, Sparkles, TrendingUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

type EjercicioIA = {
  nombre: string;
  musculoObjetivo: string;
  equipamiento: "Polea" | "Barra" | "Máquina" | "Mancuerna" | "Corporal";
  seriesObjetivo: number;
  repeticionesObjetivo: string;
  notas: string;
};

type RutinaIA = {
  titulo: string;
  descripcion: string;
  ejercicios: EjercicioIA[];
};

type RutinaResponse = {
  rutinas: RutinaIA[];
};

type EjercicioGuardado = {
  name: string;
  target_muscle: string;
  equipment: string;
};

type RutinaExerciseGuardada = {
  target_sets: number | null;
  target_reps: string | null;
  notes: string | null;
  exercises?: EjercicioGuardado | EjercicioGuardado[] | null;
};

type RutinaGuardada = {
  id: string;
  title: string;
  description: string | null;
  created_at: string;
  routine_exercises?: RutinaExerciseGuardada[];
};

type MetricSetLog = {
  weight: number | null;
  reps: number | null;
};

type MetricWorkout = {
  id: string;
  start_time: string;
  end_time: string | null;
  set_logs?: MetricSetLog[];
};

type DashboardMetrics = {
  weeklyVolume: number;
  weeklySets: number;
  weeklyWorkouts: number;
  currentStreak: number;
  lastWorkoutLabel: string;
};

type ExerciseLookupRow = {
  id: string;
};

const initialMetrics: DashboardMetrics = {
  weeklyVolume: 0,
  weeklySets: 0,
  weeklyWorkouts: 0,
  currentStreak: 0,
  lastWorkoutLabel: "Sin registros",
};

function getJoinedExercise(exercises: RutinaExerciseGuardada["exercises"]) {
  if (Array.isArray(exercises)) {
    return exercises[0] ?? null;
  }

  return exercises ?? null;
}

function normalizeExerciseText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getWorkoutVolume(setLogs?: MetricSetLog[]) {
  return (setLogs || []).reduce((sum, setLog) => {
    return sum + Number(setLog.weight || 0) * Number(setLog.reps || 0);
  }, 0);
}

function getLocalDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-CA");
}

function calcularRacha(workouts: MetricWorkout[]) {
  const completedWorkoutDates = new Set(
    workouts
      .filter((workout) => workout.end_time)
      .map((workout) => getLocalDateKey(workout.start_time))
  );

  let streak = 0;
  const cursor = new Date();

  while (completedWorkoutDates.has(getLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function formatKg(value: number) {
  return new Intl.NumberFormat("es-CL").format(Math.round(value));
}

function getLastWorkoutLabel(workouts: MetricWorkout[]) {
  if (workouts.length === 0) {
    return "Sin registros";
  }

  return new Date(workouts[0].start_time).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
  });
}

export default function Dashboard() {
  const [diasDisponibles, setDiasDisponibles] = useState("4");
  const [enfoque, setEnfoque] = useState("Hipertrofia upper/lower");
  const [restricciones, setRestricciones] = useState("Sin dominadas, sin sentadillas búlgaras y priorizar poleas");
  const [rutinasIA, setRutinasIA] = useState<RutinaIA[]>([]);
  const [rutinasGuardadas, setRutinasGuardadas] = useState<RutinaGuardada[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>(initialMetrics);
  const [user, setUser] = useState<User | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fallbackRoutines = [
    { id: 1, title: "Upper A", focus: "Pecho/Espalda", exercises: 6 },
    { id: 2, title: "Lower A", focus: "Cuádriceps/Isquios", exercises: 5 },
    { id: 3, title: "Upper B", focus: "Poleas/Accesorios", exercises: 6 },
    { id: 4, title: "Lower B", focus: "Glúteos/Isquios", exercises: 5 },
  ];

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        void cargarRutinasGuardadas();
        void cargarMetricasDashboard();
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        void cargarRutinasGuardadas();
        void cargarMetricasDashboard();
      } else {
        setRutinasGuardadas([]);
        setMetrics(initialMetrics);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function cerrarSesion() {
    await supabase.auth.signOut();
    setUser(null);
    setRutinasGuardadas([]);
    setMetrics(initialMetrics);
  }

  async function cargarRutinasGuardadas() {
    setIsLoadingSaved(true);

    const { data, error: loadError } = await supabase
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

    if (loadError) {
      setError(loadError.message);
    } else {
      setRutinasGuardadas((data || []) as unknown as RutinaGuardada[]);
    }

    setIsLoadingSaved(false);
  }

  async function cargarMetricasDashboard() {
    setIsLoadingMetrics(true);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error: metricsError } = await supabase
      .from("workout_logs")
      .select(`
        id,
        start_time,
        end_time,
        set_logs (
          weight,
          reps
        )
      `)
      .gte("start_time", thirtyDaysAgo.toISOString())
      .order("start_time", { ascending: false });

    if (metricsError) {
      setError(metricsError.message);
      setIsLoadingMetrics(false);
      return;
    }

    const workouts = (data || []) as unknown as MetricWorkout[];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weeklyWorkouts = workouts.filter((workout) => new Date(workout.start_time) >= sevenDaysAgo);
    const completedWeeklyWorkouts = weeklyWorkouts.filter((workout) => workout.end_time);
    const weeklyVolume = weeklyWorkouts.reduce((sum, workout) => sum + getWorkoutVolume(workout.set_logs), 0);
    const weeklySets = weeklyWorkouts.reduce((sum, workout) => sum + (workout.set_logs?.length || 0), 0);

    setMetrics({
      weeklyVolume,
      weeklySets,
      weeklyWorkouts: completedWeeklyWorkouts.length,
      currentStreak: calcularRacha(workouts),
      lastWorkoutLabel: getLastWorkoutLabel(workouts),
    });

    setIsLoadingMetrics(false);
  }

  async function generarRutina() {
    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/ai/generar-rutina", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          diasDisponibles: Number(diasDisponibles),
          enfoque,
          restricciones,
        }),
      });

      const data = (await response.json()) as Partial<RutinaResponse> & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "No se pudo generar la rutina.");
      }

      setRutinasIA(data.rutinas || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function getOrCreateExercise(ejercicio: EjercicioIA) {
    const name = normalizeExerciseText(ejercicio.nombre);
    const targetMuscle = normalizeExerciseText(ejercicio.musculoObjetivo);
    const equipment = normalizeExerciseText(ejercicio.equipamiento);

    const { data: existingExercise, error: lookupError } = await supabase
      .from("exercises")
      .select("id")
      .ilike("name", name)
      .ilike("target_muscle", targetMuscle)
      .ilike("equipment", equipment)
      .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if ((existingExercise as ExerciseLookupRow | null)?.id) {
      return (existingExercise as ExerciseLookupRow).id;
    }

    const { data: exerciseRow, error: exerciseError } = await supabase
      .from("exercises")
      .insert({
        name,
        target_muscle: targetMuscle,
        equipment,
      })
      .select("id")
      .single();

    if (exerciseError) {
      const { data: existingAfterConflict } = await supabase
        .from("exercises")
        .select("id")
        .ilike("name", name)
        .ilike("target_muscle", targetMuscle)
        .ilike("equipment", equipment)
        .maybeSingle();

      if ((existingAfterConflict as ExerciseLookupRow | null)?.id) {
        return (existingAfterConflict as ExerciseLookupRow).id;
      }

      throw exerciseError;
    }

    if (!exerciseRow?.id) {
      throw new Error(`No se pudo crear el ejercicio ${name}.`);
    }

    return exerciseRow.id as string;
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
      const { data: routineRow, error: routineError } = await supabase
        .from("routines")
        .insert({
          user_id: user.id,
          title: rutina.titulo,
          description: rutina.descripcion,
        })
        .select("id")
        .single();

      if (routineError) throw routineError;
      if (!routineRow?.id) throw new Error("No se pudo crear la rutina.");

      for (let index = 0; index < rutina.ejercicios.length; index += 1) {
        const ejercicio = rutina.ejercicios[index];
        const exerciseId = await getOrCreateExercise(ejercicio);

        const { error: relationError } = await supabase.from("routine_exercises").insert({
          routine_id: routineRow.id,
          exercise_id: exerciseId,
          order_index: index + 1,
          target_sets: ejercicio.seriesObjetivo,
          target_reps: ejercicio.repeticionesObjetivo,
          notes: ejercicio.notas,
        });

        if (relationError) throw relationError;
      }

      setSuccessMessage(`Rutina "${rutina.titulo}" guardada en Supabase.`);
      await cargarRutinasGuardadas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la rutina.");
    } finally {
      setIsSaving(false);
    }
  }

  async function guardarTodasLasRutinas() {
    for (const rutina of rutinasIA) {
      await guardarRutina(rutina);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-28 font-sans max-w-md mx-auto">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hola, Guerrero</h1>
          <p className="text-zinc-400">Hoy toca romper tus límites.</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
          <TrendingUp className="text-[#CCFF00] w-6 h-6" />
        </div>
      </header>

      <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Cuenta</p>
            <h2 className="text-lg font-bold">{user ? "Sesión activa" : "Crea tu usuario"}</h2>
            <p className="text-xs text-zinc-500 mt-1">{user ? user.email : "Usa email y contraseña para guardar progreso."}</p>
          </div>
          {user ? (
            <button onClick={cerrarSesion} className="rounded-full bg-zinc-900 p-3 text-zinc-400">
              <LogOut className="h-5 w-5" />
            </button>
          ) : (
            <Link href="/auth" className="rounded-full bg-[#CCFF00] px-4 py-2 text-xs font-black text-black">
              Ingresar
            </Link>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase font-bold">Volumen Semana</p>
          <p className="text-2xl font-bold mt-1">
            {isLoadingMetrics ? "..." : formatKg(metrics.weeklyVolume)} <span className="text-[10px] text-zinc-400">kg</span>
          </p>
        </div>
        <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase font-bold">Series Semana</p>
          <p className="text-2xl font-bold mt-1">{isLoadingMetrics ? "..." : metrics.weeklySets}</p>
        </div>
        <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase font-bold">Workouts</p>
          <p className="text-2xl font-bold mt-1">{isLoadingMetrics ? "..." : metrics.weeklyWorkouts}</p>
        </div>
        <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase font-bold">Racha</p>
          <p className="text-2xl font-bold mt-1">{isLoadingMetrics ? "..." : metrics.currentStreak} <span className="text-[10px] text-zinc-400">días</span></p>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs text-zinc-500">
        Último entrenamiento: <span className="font-bold text-zinc-300">{isLoadingMetrics ? "Cargando..." : metrics.lastWorkoutLabel}</span>
      </section>

      <section className="grid grid-cols-2 gap-3 mb-8">
        <Link href="/entrenar" className="rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black inline-flex items-center justify-center gap-2">
          <Play className="h-5 w-5" /> Entrenar
        </Link>
        <Link href="/historial" className="rounded-2xl bg-zinc-900 px-4 py-3 font-black text-white inline-flex items-center justify-center gap-2 border border-zinc-800">
          <History className="h-5 w-5" /> Historial
        </Link>
      </section>

      <section className="mb-8">
        <div className="bg-gradient-to-br from-[#CCFF00] to-[#99cc00] p-6 rounded-3xl text-black relative overflow-hidden group active:scale-95 transition-transform">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <BrainCircuit className="w-5 h-5" />
              <span className="font-bold uppercase text-xs tracking-wider">Coach IA Activo</span>
            </div>
            <h2 className="text-xl font-black leading-tight mb-2">Genera una rutina adaptada a tus restricciones y objetivos de hoy.</h2>
            <button
              onClick={generarRutina}
              disabled={isGenerating}
              className="bg-black text-white px-4 py-2 rounded-full text-xs font-bold mt-2 inline-flex items-center gap-2 disabled:opacity-60"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isGenerating ? "Generando..." : "Generar con IA"}
            </button>
          </div>
          <BrainCircuit className="absolute -right-4 -bottom-4 w-32 h-32 text-black/10 rotate-12" />
        </div>
      </section>

      <section className="mb-8 bg-zinc-950 border border-zinc-800 rounded-3xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Nueva rutina IA</p>
            <h3 className="text-lg font-bold">Parámetros</h3>
          </div>
          <BrainCircuit className="w-6 h-6 text-zinc-500" />
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-400">Días disponibles</span>
            <input
              value={diasDisponibles}
              onChange={(event) => setDiasDisponibles(event.target.value)}
              inputMode="numeric"
              className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-zinc-400">Enfoque</span>
            <input
              value={enfoque}
              onChange={(event) => setEnfoque(event.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-zinc-400">Restricciones</span>
            <textarea
              value={restricciones}
              onChange={(event) => setRestricciones(event.target.value)}
              rows={3}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00] resize-none"
            />
          </label>

          <button
            onClick={generarRutina}
            disabled={isGenerating}
            className="w-full bg-[#CCFF00] text-black rounded-2xl py-3 font-black inline-flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.99] transition-transform"
          >
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            {isGenerating ? "Generando rutina..." : "Crear rutina con Gemini"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mt-4 rounded-2xl border border-lime-900/60 bg-lime-950/40 p-4 text-sm text-lime-200 inline-flex gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0" /> {successMessage}
          </div>
        )}
      </section>

      {rutinasIA.length > 0 && (
        <section className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Rutina generada</h3>
            <button
              onClick={guardarTodasLasRutinas}
              disabled={isSaving || !user}
              className="text-[#CCFF00] text-sm flex items-center gap-1 disabled:opacity-40"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar todo
            </button>
          </div>

          <div className="grid gap-4">
            {rutinasIA.map((rutina, index) => (
              <article key={`${rutina.titulo}-${index}`} className="bg-zinc-950 border border-zinc-800 rounded-3xl p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-[#CCFF00] font-bold uppercase">Día {index + 1}</p>
                    <h4 className="text-xl font-black">{rutina.titulo}</h4>
                    <p className="text-sm text-zinc-400 mt-1">{rutina.descripcion}</p>
                  </div>
                  <button
                    onClick={() => guardarRutina(rutina)}
                    disabled={isSaving || !user}
                    className="rounded-full bg-zinc-900 p-3 text-[#CCFF00] disabled:opacity-40"
                    title={user ? "Guardar rutina" : "Inicia sesión para guardar"}
                  >
                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  </button>
                </div>

                <div className="grid gap-3">
                  {rutina.ejercicios.map((ejercicio, exerciseIndex) => (
                    <div key={`${ejercicio.nombre}-${exerciseIndex}`} className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h5 className="font-bold">{ejercicio.nombre}</h5>
                          <p className="text-xs text-zinc-500">{ejercicio.musculoObjetivo} • {ejercicio.equipamiento}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-[#CCFF00]">{ejercicio.seriesObjetivo}x</p>
                          <p className="text-xs text-zinc-400">{ejercicio.repeticionesObjetivo}</p>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-400 mt-3">{ejercicio.notas}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Rutinas guardadas</h3>
          <button
            onClick={() => {
              void cargarRutinasGuardadas();
              void cargarMetricasDashboard();
            }}
            disabled={!user || isLoadingSaved || isLoadingMetrics}
            className="text-[#CCFF00] text-sm flex items-center gap-1 disabled:opacity-40"
          >
            {isLoadingSaved || isLoadingMetrics ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
            Actualizar
          </button>
        </div>

        {!user && <p className="text-sm text-zinc-500">Inicia sesión para ver tus rutinas guardadas.</p>}

        {user && rutinasGuardadas.length === 0 && !isLoadingSaved && (
          <p className="text-sm text-zinc-500">Aún no tienes rutinas guardadas.</p>
        )}

        <div className="grid gap-4">
          {rutinasGuardadas.map((rutina) => (
            <article key={rutina.id} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-bold">{rutina.title}</h4>
                  <p className="text-xs text-zinc-500 mt-1">{rutina.description}</p>
                </div>
                <Dumbbell className="h-5 w-5 text-[#CCFF00] shrink-0" />
              </div>
              <div className="mt-4 grid gap-2">
                {(rutina.routine_exercises || []).map((item, index) => {
                  const exercise = getJoinedExercise(item.exercises);

                  return (
                    <div key={`${rutina.id}-${index}`} className="flex items-center justify-between rounded-xl bg-zinc-950 px-3 py-2 text-xs">
                      <span className="text-zinc-300">{exercise?.name || "Ejercicio"}</span>
                      <span className="text-zinc-500">{item.target_sets || 3}x {item.target_reps || "10-12"}</span>
                    </div>
                  );
                })}
              </div>
              <Link
                href={`/entrenar/${rutina.id}`}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black"
              >
                <Play className="h-5 w-5" /> Entrenar esta rutina
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Rutinas sugeridas</h3>
          <button onClick={generarRutina} disabled={isGenerating} className="text-[#CCFF00] text-sm flex items-center gap-1 disabled:opacity-60">
            <Plus className="w-4 h-4" /> Nueva
          </button>
        </div>
        <div className="grid gap-4">
          {fallbackRoutines.map((routine) => (
            <div key={routine.id} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between hover:border-zinc-600 transition-colors cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center group-hover:bg-[#CCFF00] group-hover:text-black transition-colors">
                  <Dumbbell className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold">{routine.title}</h4>
                  <p className="text-xs text-zinc-500">{routine.focus} • {routine.exercises} ej.</p>
                </div>
              </div>
              <button onClick={generarRutina} disabled={isGenerating} className="p-2 bg-zinc-800 rounded-full text-zinc-400 disabled:opacity-60">
                <Plus className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-950/80 backdrop-blur-md border-t border-zinc-800 px-8 py-4 flex justify-between items-center z-50">
        <Link href="/entrenar" className="text-[#CCFF00] flex flex-col items-center gap-1">
          <Dumbbell className="w-6 h-6" />
          <span className="text-[10px] font-bold">Entrenar</span>
        </Link>
        <Link href="/" className="text-zinc-500 flex flex-col items-center gap-1">
          <TrendingUp className="w-6 h-6" />
          <span className="text-[10px] font-bold">Dashboard</span>
        </Link>
        <Link href="/historial" className="text-zinc-500 flex flex-col items-center gap-1">
          <History className="w-6 h-6" />
          <span className="text-[10px] font-bold">Historial</span>
        </Link>
      </nav>
    </div>
  );
}
