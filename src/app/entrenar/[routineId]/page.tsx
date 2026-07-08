"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Flame, Loader2, Play, Repeat, Square, Wand2 } from "lucide-react";
import { one } from "@/lib/supabaseJoins";
import { useWorkoutSession } from "@/features/workout/hooks/useWorkoutSession";
import { defaultInput } from "@/features/workout/domain/workoutMetrics";
import { ExerciseCard } from "@/features/workout/components/ExerciseCard";
import { ReadinessModal } from "@/features/workout/components/ReadinessModal";
import { RegeneratePanel } from "@/features/workout/components/RegeneratePanel";
import { RestTimerBanner } from "@/features/workout/components/RestTimerBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { supabase } from "@/lib/supabase";
import { useState } from "react";

export default function EntrenarPage() {
  const params = useParams<{ routineId: string }>();
  const routineId = params.routineId;
  const session = useWorkoutSession(routineId);
  const [warmup, setWarmup] = useState<Array<{ nombre: string; descripcion: string; duracionSegundos: number; tipo: string }> | null>(null);
  const [isLoadingWarmup, setIsLoadingWarmup] = useState(false);

  const muscleGroups = session.routine
    ? [...new Set((session.routine.routine_exercises || []).map((item) => one(item.exercises)?.target_muscle).filter(Boolean) as string[])]
    : [];

  async function generarCalentamiento() {
    setIsLoadingWarmup(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const accessToken = authSession?.access_token;
      const response = await fetch("/api/ai/generar-calentamiento", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ muscleGroups }),
      });
      const data = await response.json();
      setWarmup(data.calentamiento || []);
    } catch {
      setWarmup(null);
    } finally {
      setIsLoadingWarmup(false);
    }
  }

  if (session.isLoading) {
    return (
      <main className="min-h-screen bg-black text-white p-6 max-w-md mx-auto flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#CCFF00]" />
          <p className="mt-3 text-sm text-zinc-400">Cargando entrenamiento...</p>
        </div>
      </main>
    );
  }

  if (!session.user) {
    return (
      <main className="min-h-screen bg-black text-white p-6 max-w-md mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-8">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h1 className="text-2xl font-black">Inicia sesión</h1>
          <p className="mt-2 text-sm text-zinc-400">Debes iniciar sesión desde el dashboard para registrar entrenamientos y guardar series.</p>
          <Link href="/" className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">
            Ir al dashboard
          </Link>
        </section>
      </main>
    );
  }

  if (!session.routine) {
    return (
      <main className="min-h-screen bg-black text-white p-6 max-w-md mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-8">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
        <section className="rounded-3xl border border-red-900/60 bg-red-950/30 p-5">
          <h1 className="text-2xl font-black">Rutina no encontrada</h1>
          <p className="mt-2 text-sm text-red-200">{session.error || "No pudimos cargar esta rutina."}</p>
        </section>
      </main>
    );
  }

  const { routine } = session;

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-28 font-sans max-w-md mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Entrenamiento activo</p>
            <h1 className="text-3xl font-black tracking-tight mt-1">{routine.title}</h1>
            <p className="text-sm text-zinc-400 mt-2">{routine.description || "Registra peso, repeticiones y RPE por serie."}</p>
            {routine.is_deload_week && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase text-amber-300">
                Semana de deload · sin PRs, ~10% menos de carga
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => session.setShowRegeneratePanel((current) => !current)}
            disabled={Boolean(session.workoutLogId)}
            title={session.workoutLogId ? "Finaliza o descarta el entrenamiento en curso para regenerar el día" : undefined}
            className="shrink-0 rounded-full bg-zinc-900 p-3 text-[#CCFF00] disabled:opacity-30"
            aria-label="Regenerar día con IA"
          >
            <Wand2 className="h-5 w-5" />
          </button>
        </div>

        {session.showRegeneratePanel && (
          <RegeneratePanel
            instructions={session.regenerateInstructions}
            onInstructionsChange={session.setRegenerateInstructions}
            isRegenerating={session.isRegenerating}
            onRegenerate={() => void session.regenerarDia()}
            onCancel={() => session.setShowRegeneratePanel(false)}
          />
        )}
      </header>

      {session.readinessGuidance && session.readinessGuidance.warnings.length > 0 && (
        <section className="mb-6 grid gap-2">
          {session.readinessGuidance.warnings.map((warning) => (
            <div key={warning} className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{warning}</p>
            </div>
          ))}
        </section>
      )}

      {session.showReadinessModal && (
        <ReadinessModal
          form={session.readinessForm}
          onFormChange={(patch) => session.setReadinessForm((current) => ({ ...current, ...patch }))}
          onAdapt={() => void session.iniciarConReadiness(true)}
          onSkip={() => void session.iniciarConReadiness(false)}
        />
      )}

      {session.restSecondsLeft !== null && (
        <RestTimerBanner secondsLeft={session.restSecondsLeft} onDismiss={() => session.setRestSecondsLeft(null)} />
      )}

      <div className="mb-6">
        <OfflineBanner />
      </div>

      <section className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs text-zinc-500 uppercase font-bold">Estado</p>
          <p className="mt-1 text-lg font-black">{session.workoutLogId ? "En curso" : "Sin iniciar"}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs text-zinc-500 uppercase font-bold">Inicio</p>
          <p className="mt-1 text-lg font-black">
            {session.startTime ? session.startTime.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
          </p>
        </div>
      </section>

      {session.routineExercises.length > 0 && (
        <section className="mb-6">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-bold text-zinc-300">Progreso de la rutina</span>
            <span className="text-zinc-500">
              {session.completedExerciseIds.size}/{session.routineExercises.length} ejercicios
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-zinc-900">
            <div
              className="h-full rounded-full bg-[#CCFF00] transition-all"
              style={{ width: `${Math.round((session.completedExerciseIds.size / session.routineExercises.length) * 100)}%` }}
            />
          </div>
        </section>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3">
        <button
          onClick={() => session.setShowReadinessModal(true)}
          disabled={Boolean(session.workoutLogId) || session.isStarting}
          className="rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black inline-flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {session.isStarting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
          Iniciar
        </button>
        <button
          onClick={() => void session.finalizarEntrenamiento()}
          disabled={!session.workoutLogId || session.isFinishing}
          className="rounded-2xl bg-zinc-900 px-4 py-3 font-black text-white inline-flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {session.isFinishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Square className="h-5 w-5" />}
          {session.isFinishing ? "Analizando..." : "Finalizar"}
        </button>
      </section>

      {Object.keys(session.suggestions).length > 0 && (
        <button
          type="button"
          onClick={session.aplicarTodasLasSugerencias}
          className="mb-6 w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-bold text-zinc-300"
        >
          <Repeat className="h-4 w-4" /> Copiar sesión anterior completa
        </button>
      )}

      {/* Warm-up generation */}
      {session.routine && !session.workoutLogId && (
        <section className="mb-6">
          <button
            onClick={generarCalentamiento}
            disabled={isLoadingWarmup}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-300 disabled:opacity-40"
          >
            {isLoadingWarmup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
            {isLoadingWarmup ? "Generando..." : warmup ? "Regenerar calentamiento" : "Generar calentamiento con IA"}
          </button>
          {warmup && warmup.length > 0 && (
            <div className="mt-3 grid gap-2">
              {warmup.map((ej, i) => (
                <div key={i} className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-amber-200">{ej.nombre}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{ej.descripcion}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300">{ej.tipo} · {ej.duracionSegundos}s</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {session.error && <div className="mb-6 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{session.error}</div>}

      {session.successMessage && (
        <div className="mb-6 rounded-2xl border border-lime-900/60 bg-lime-950/40 p-4 text-sm text-lime-200 inline-flex gap-2">
          <CheckCircle2 className="h-5 w-5 shrink-0" /> {session.successMessage}
        </div>
      )}

      <section className="grid gap-4">
        {session.routineExercises.map((item) => {
          const exercise = one(item.exercises);
          const currentInput = session.inputs[item.id] || defaultInput();
          const localLogs = exercise?.id ? session.setLogs[exercise.id] || [] : [];
          const suggestion = exercise?.id ? session.suggestions[exercise.id] : undefined;
          const isCompleted = session.completedExerciseIds.has(item.id);
          const isOptionalToday =
            Boolean(session.readinessGuidance?.deprioritizeAccessories) && (item.priority === "accesorio" || item.priority === "aislamiento");

          return (
            <ExerciseCard
              key={item.id}
              item={item}
              exercise={exercise}
              currentInput={currentInput}
              localLogs={localLogs}
              suggestion={suggestion}
              isCompleted={isCompleted}
              isOptionalToday={isOptionalToday}
              isSavingSet={session.isSavingSet}
              isSubstitutingThis={session.substitutingItemId === item.id}
              substituteOptions={session.substituteOptions}
              isLoadingSubstitutes={session.isLoadingSubstitutes}
              isSubstituting={session.isSubstituting}
              cardRef={(el) => {
                session.exerciseRefs.current[item.id] = el;
              }}
              onToggleCompleted={() => session.marcarCompletado(item.id)}
              onToggleSubstitution={() =>
                session.substitutingItemId === item.id ? session.cerrarSustitucion() : void session.abrirSustitucion(item)
              }
              onSelectSubstitute={(option) => void session.sustituirEjercicio(item, option)}
              onCancelSubstitution={session.cerrarSustitucion}
              onApplySuggestion={(s) => session.aplicarSugerencia(item.id, s)}
              onCopyPreviousSet={(log) => session.copiarSerieAnterior(item.id, log)}
              onUpdateInput={(patch) => session.updateInput(item.id, patch)}
              onAdjustWeight={(delta) => session.ajustarPeso(item.id, delta)}
              onAdjustReps={(delta) => session.ajustarReps(item.id, delta)}
              onRegisterSet={() => void session.registrarSerie(item)}
              isFavorite={exercise?.id ? session.favoriteExerciseIds.has(exercise.id) : false}
              isAvoided={exercise?.id ? session.avoidedExerciseIds.has(exercise.id) : false}
              onToggleFavorite={() => exercise?.id && session.toggleFavorite(exercise.id)}
              onToggleAvoided={() => exercise?.id && session.toggleAvoided(exercise.id)}
              favoriteExerciseIds={session.favoriteExerciseIds}
              recentPRs={exercise?.id ? session.recentPRs[exercise.id] : undefined}
              onDismissPR={() => exercise?.id && session.clearRecentPRs(exercise.id)}
            />
          );
        })}
      </section>
    </main>
  );
}
