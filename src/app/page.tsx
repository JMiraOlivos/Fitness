"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BrainCircuit, CheckCircle2, Dumbbell, History, Loader2, LogOut, Play, Save, Sparkles, Trash2, TrendingUp, UserCog } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { one } from "@/lib/supabaseJoins";
import { useSession } from "@/components/SessionProvider";
import { authFetch } from "@/lib/authFetch";

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
  is_warmup: boolean;
};

type MetricWorkout = {
  id: string;
  start_time: string;
  end_time: string | null;
  set_logs?: MetricSetLog[];
};

function getWorkingSets(setLogs?: MetricSetLog[]) {
  return (setLogs || []).filter((setLog) => !setLog.is_warmup);
}

type DashboardMetrics = {
  weeklyVolume: number;
  weeklySets: number;
  weeklyWorkouts: number;
  currentStreak: number;
  lastWorkoutLabel: string;
};

const initialMetrics: DashboardMetrics = {
  weeklyVolume: 0,
  weeklySets: 0,
  weeklyWorkouts: 0,
  currentStreak: 0,
  lastWorkoutLabel: "Sin registros",
};

function getWorkoutVolume(setLogs?: MetricSetLog[]) {
  return getWorkingSets(setLogs).reduce((sum, setLog) => sum + Number(setLog.weight || 0) * Number(setLog.reps || 0), 0);
}

function getLocalDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("en-CA");
}

function calcularRacha(workouts: MetricWorkout[]) {
  const dates = new Set(workouts.filter((workout) => workout.end_time).map((workout) => getLocalDateKey(workout.start_time)));
  let streak = 0;
  const cursor = new Date();

  while (dates.has(getLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function formatKg(value: number) {
  return new Intl.NumberFormat("es-CL").format(Math.round(value));
}

function getLastWorkoutLabel(workouts: MetricWorkout[]) {
  if (workouts.length === 0) return "Sin registros";
  return new Date(workouts[0].start_time).toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

export default function Dashboard() {
  const [diasDisponibles, setDiasDisponibles] = useState("4");
  const [enfoque, setEnfoque] = useState("Hipertrofia upper/lower");
  const [restricciones, setRestricciones] = useState("");
  const [rutinasIA, setRutinasIA] = useState<RutinaIA[]>([]);
  const [rutinasGuardadas, setRutinasGuardadas] = useState<RutinaGuardada[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>(initialMetrics);
  const { user, isLoading: isSessionLoading } = useSession();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const precargarPerfil = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("training_goal, injury_notes")
      .eq("id", user.id)
      .maybeSingle();

    if (!data) return;

    if (data.training_goal) setEnfoque(data.training_goal);
    if (data.injury_notes) setRestricciones(data.injury_notes);
  }, [user]);

  useEffect(() => {
    if (isSessionLoading) return;

    if (user) {
      void cargarRutinasGuardadas();
      void cargarMetricasDashboard();
      void precargarPerfil();
    } else {
      setRutinasGuardadas([]);
      setMetrics(initialMetrics);
    }
  }, [user, isSessionLoading, precargarPerfil]);

  async function cerrarSesion() {
    await supabase.auth.signOut();
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

    if (loadError) setError(loadError.message);
    else setRutinasGuardadas((data || []) as unknown as RutinaGuardada[]);

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
          reps,
          is_warmup
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
    const weeklySets = weeklyWorkouts.reduce((sum, workout) => sum + getWorkingSets(workout.set_logs).length, 0);

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
      // Best-effort: attach the access token when logged in so the route can merge
      // profile preferences (see /perfil); anonymous callers still get a preview.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const response = await fetch("/api/ai/generar-rutina", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ diasDisponibles: Number(diasDisponibles), enfoque, restricciones }),
      });

      const data = (await response.json()) as Partial<RutinaResponse> & { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo generar la rutina.");

      setRutinasIA(data.rutinas || []);
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
      await authFetch("/api/routines/save", { rutina });

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
      await authFetch("/api/routines/delete", { routineId: rutina.id });

      setRutinasGuardadas((current) => current.filter((item) => item.id !== rutina.id));
      setSuccessMessage(`Rutina "${rutina.title}" borrada.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar la rutina.");
    } finally {
      setIsDeleting(false);
      setConfirmingDeleteId(null);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-28 font-sans max-w-md mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Hola, Guerrero</h1>
          <p className="text-zinc-400">Tu entrenamiento, progreso e IA en un solo lugar.</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
          <TrendingUp className="text-[#CCFF00] w-6 h-6" />
        </div>
      </header>

      <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Cuenta</p>
            <h2 className="text-lg font-bold">{user ? "Sesión activa" : "Crea tu usuario"}</h2>
            <p className="text-xs text-zinc-500 mt-1">{user ? user.email : "Usa email y contraseña para guardar progreso."}</p>
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <Link href="/perfil" className="rounded-full bg-zinc-900 p-3 text-zinc-400">
                <UserCog className="h-5 w-5" />
              </Link>
              <button onClick={cerrarSesion} className="rounded-full bg-zinc-900 p-3 text-zinc-400">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <Link href="/auth" className="rounded-full bg-[#CCFF00] px-4 py-2 text-xs font-black text-black">
              Ingresar
            </Link>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 mb-4">
        <MetricCard label="Volumen semana" value={isLoadingMetrics ? "..." : `${formatKg(metrics.weeklyVolume)} kg`} />
        <MetricCard label="Series semana" value={isLoadingMetrics ? "..." : String(metrics.weeklySets)} />
        <MetricCard label="Workouts" value={isLoadingMetrics ? "..." : String(metrics.weeklyWorkouts)} />
        <MetricCard label="Racha" value={isLoadingMetrics ? "..." : `${metrics.currentStreak} días`} />
      </section>

      <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs text-zinc-500">
        Último entrenamiento: <span className="font-bold text-zinc-300">{isLoadingMetrics ? "Cargando..." : metrics.lastWorkoutLabel}</span>
      </section>

      <section className="grid grid-cols-2 gap-3 mb-8">
        <Link href="/entrenar" className="rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black inline-flex items-center justify-center gap-2">
          <Play className="h-5 w-5" /> Entrenar
        </Link>
        <Link href="/historial" className="rounded-2xl bg-zinc-900 px-4 py-3 font-black text-white inline-flex items-center justify-center gap-2 border border-zinc-800">
          <History className="h-5 w-5" /> Historial
        </Link>
        <Link href="/progreso" className="col-span-2 rounded-2xl bg-zinc-950 px-4 py-3 font-black text-white inline-flex items-center justify-center gap-2 border border-zinc-800">
          <TrendingUp className="h-5 w-5 text-[#CCFF00]" /> Ver progreso
        </Link>
      </section>

      <section className="mb-8 bg-zinc-950 border border-zinc-800 rounded-3xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Coach IA</p>
            <h3 className="text-lg font-bold">Generar rutina</h3>
          </div>
          <BrainCircuit className="w-6 h-6 text-zinc-500" />
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-400">Días disponibles</span>
            <input value={diasDisponibles} onChange={(event) => setDiasDisponibles(event.target.value)} inputMode="numeric" className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-400">Enfoque</span>
            <input value={enfoque} onChange={(event) => setEnfoque(event.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]" />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-zinc-400">Restricciones</span>
            <textarea
              value={restricciones}
              onChange={(event) => setRestricciones(event.target.value)}
              rows={3}
              placeholder="Ej: molestia en el hombro derecho, evitar sentadilla libre"
              className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00] resize-none"
            />
          </label>
          <button onClick={generarRutina} disabled={isGenerating} className="w-full bg-[#CCFF00] text-black rounded-2xl py-3 font-black inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {isGenerating ? "Generando..." : "Crear rutina con IA"}
          </button>
        </div>

        {error && <div className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>}
        {successMessage && <div className="mt-4 rounded-2xl border border-lime-900/60 bg-lime-950/40 p-4 text-sm text-lime-200 inline-flex gap-2"><CheckCircle2 className="h-5 w-5 shrink-0" /> {successMessage}</div>}
      </section>

      {rutinasIA.length > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-bold mb-4">Rutinas generadas</h3>
          <div className="grid gap-4">
            {rutinasIA.map((rutina, index) => (
              <article key={`${rutina.titulo}-${index}`} className="bg-zinc-950 border border-zinc-800 rounded-3xl p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-[#CCFF00] font-bold uppercase">Día {index + 1}</p>
                    <h4 className="text-xl font-black">{rutina.titulo}</h4>
                    <p className="text-sm text-zinc-400 mt-1">{rutina.descripcion}</p>
                  </div>
                  <button onClick={() => guardarRutina(rutina)} disabled={isSaving || !user} className="rounded-full bg-zinc-900 p-3 text-[#CCFF00] disabled:opacity-40">
                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                  </button>
                </div>
                <ExercisePreview ejercicios={rutina.ejercicios} />
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Rutinas guardadas</h3>
          <button onClick={() => void cargarRutinasGuardadas()} disabled={!user || isLoadingSaved} className="text-[#CCFF00] text-sm flex items-center gap-1 disabled:opacity-40">
            {isLoadingSaved ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
            Actualizar
          </button>
        </div>

        {!user && <EmptyState title="Inicia sesión" text="Crea usuario o ingresa para ver tus rutinas guardadas." href="/auth" action="Ir a login" />}
        {user && rutinasGuardadas.length === 0 && !isLoadingSaved && <EmptyState title="Sin rutinas guardadas" text="Genera tu primera rutina con IA y guárdala para entrenar." />}

        <div className="grid gap-4">
          {rutinasGuardadas.map((rutina) => (
            <article key={rutina.id} className="bg-zinc-950 p-4 rounded-3xl border border-zinc-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-black text-xl">{rutina.title}</h4>
                  <p className="text-xs text-zinc-500 mt-1">{rutina.description}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Dumbbell className="h-5 w-5 text-[#CCFF00]" />
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(confirmingDeleteId === rutina.id ? null : rutina.id)}
                    className="rounded-full bg-zinc-900 p-2 text-zinc-500"
                    aria-label="Borrar rutina"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {confirmingDeleteId === rutina.id && (
                <div className="mt-3 rounded-2xl border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-200">
                  <p>¿Borrar esta rutina? Esta acción no se puede deshacer.</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => void borrarRutina(rutina)}
                      className="flex-1 rounded-xl bg-red-500/90 py-2 font-bold text-black disabled:opacity-50"
                    >
                      {isDeleting ? "Borrando..." : "Sí, borrar"}
                    </button>
                    <button type="button" onClick={() => setConfirmingDeleteId(null)} className="flex-1 rounded-xl bg-zinc-900 py-2 font-bold text-zinc-300">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-2">
                {(rutina.routine_exercises || []).slice(0, 5).map((item, index) => {
                  const exercise = one(item.exercises);
                  return (
                    <div key={`${rutina.id}-${index}`} className="flex items-center justify-between rounded-xl bg-zinc-900 px-3 py-2 text-xs">
                      <span className="text-zinc-300">{exercise?.name || "Ejercicio"}</span>
                      <span className="text-zinc-500">{item.target_sets || 3}x {item.target_reps || "10-12"}</span>
                    </div>
                  );
                })}
              </div>
              <Link href={`/entrenar/${rutina.id}`} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">
                <Play className="h-5 w-5" /> Entrenar esta rutina
              </Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
      <p className="text-xs text-zinc-500 uppercase font-bold">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function EmptyState({ title, text, href, action }: { title: string; text: string; href?: string; action?: string }) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
      <h4 className="text-xl font-black">{title}</h4>
      <p className="text-sm text-zinc-400 mt-2">{text}</p>
      {href && action && <Link href={href} className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">{action}</Link>}
    </div>
  );
}

function ExercisePreview({ ejercicios }: { ejercicios: EjercicioIA[] }) {
  return (
    <div className="grid gap-3">
      {ejercicios.map((ejercicio, index) => (
        <div key={`${ejercicio.nombre}-${index}`} className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h5 className="font-bold">{ejercicio.nombre}</h5>
              <p className="text-xs text-zinc-500">{ejercicio.musculoObjetivo} · {ejercicio.equipamiento}</p>
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
  );
}
