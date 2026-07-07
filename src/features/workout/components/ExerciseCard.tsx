import { CheckCircle, Clock, Dumbbell, Repeat, Sparkles, Star } from "lucide-react";
import { formatRelativeDate, formatRestTime, PRIORITY_LABELS } from "../domain/workoutMetrics";
import { SetLogger } from "./SetLogger";
import { SubstitutionPanel } from "./SubstitutionPanel";
import { prLabel, type PersonalRecord } from "@/lib/training/pr";
import type { ExerciseRow, ExerciseSuggestion, LocalSetLog, RoutineExerciseRow, SetInput } from "../types";

type ExerciseCardProps = {
  item: RoutineExerciseRow;
  exercise: ExerciseRow | null | undefined;
  currentInput: SetInput;
  localLogs: LocalSetLog[];
  suggestion: ExerciseSuggestion | undefined;
  isCompleted: boolean;
  isOptionalToday: boolean;
  isSavingSet: boolean;
  isSubstitutingThis: boolean;
  substituteOptions: ExerciseRow[];
  isLoadingSubstitutes: boolean;
  isSubstituting: boolean;
  cardRef: (el: HTMLElement | null) => void;
  onToggleCompleted: () => void;
  onToggleSubstitution: () => void;
  onSelectSubstitute: (option: ExerciseRow) => void;
  onCancelSubstitution: () => void;
  onApplySuggestion: (suggestion: ExerciseSuggestion) => void;
  onCopyPreviousSet: (log: LocalSetLog) => void;
  onUpdateInput: (patch: Partial<SetInput>) => void;
  onAdjustWeight: (delta: number) => void;
  onAdjustReps: (delta: number) => void;
  onRegisterSet: () => void;
  isFavorite: boolean;
  isAvoided: boolean;
  onToggleFavorite: () => void;
  onToggleAvoided: () => void;
  favoriteExerciseIds: Set<string>;
  recentPRs?: PersonalRecord[];
  onDismissPR?: () => void;
};

export function ExerciseCard({
  item,
  exercise,
  currentInput,
  localLogs,
  suggestion,
  isCompleted,
  isOptionalToday,
  isSavingSet,
  isSubstitutingThis,
  substituteOptions,
  isLoadingSubstitutes,
  isSubstituting,
  cardRef,
  onToggleCompleted,
  onToggleSubstitution,
  onSelectSubstitute,
  onCancelSubstitution,
  onApplySuggestion,
  onCopyPreviousSet,
  onUpdateInput,
  onAdjustWeight,
  onAdjustReps,
  onRegisterSet,
  isFavorite,
  isAvoided,
  onToggleFavorite,
  onToggleAvoided,
  favoriteExerciseIds,
  recentPRs,
  onDismissPR,
}: ExerciseCardProps) {
  const prescriptionSummary = [
    item.target_rpe ? `RPE ${item.target_rpe}` : null,
    item.target_rir ? `RIR ${item.target_rir}` : null,
    item.rest_seconds ? `descanso ${formatRestTime(item.rest_seconds)}` : null,
    item.tempo ? `tempo ${item.tempo}` : null,
    item.priority ? PRIORITY_LABELS[item.priority] : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      ref={cardRef}
      className={`rounded-3xl border p-4 transition-opacity ${
        isCompleted ? "border-zinc-800 bg-zinc-950/60 opacity-60" : "border-zinc-800 bg-zinc-950"
      } ${isOptionalToday && !isCompleted ? "opacity-70" : ""}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[#CCFF00] font-bold uppercase">Ejercicio {item.order_index}</p>
          <div className="flex items-center gap-2 mt-1">
            <h2 className="text-xl font-black">{exercise?.name || "Ejercicio"}</h2>
            <button
              type="button"
              onClick={onToggleFavorite}
              title={isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
              className="shrink-0 leading-none"
            >
              <Star className={`h-4 w-4 ${isFavorite ? "fill-[#CCFF00] text-[#CCFF00]" : "text-zinc-600"}`} />
            </button>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {exercise?.target_muscle || "Músculo"} • {exercise?.equipment || "Equipo"}
          </p>
          {isOptionalToday && <p className="mt-1 text-[10px] font-bold uppercase text-amber-300">Opcional hoy · poco tiempo</p>}
          {isAvoided && <p className="mt-1 text-[10px] font-bold uppercase text-red-400">Evitado · usa Sustituir</p>}

          {recentPRs && recentPRs.length > 0 && (
            <div className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase text-amber-300 inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Récord Personal
                </p>
                {recentPRs.map((pr) => (
                  <p key={pr.metric} className="mt-0.5 text-xs font-bold text-amber-200">{prLabel(pr)}</p>
                ))}
              </div>
              {onDismissPR && (
                <button type="button" onClick={onDismissPR} className="shrink-0 text-[10px] font-bold text-zinc-500">X</button>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <button type="button" onClick={onToggleCompleted} className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-400">
            {isCompleted ? (
              <>
                <CheckCircle className="h-5 w-5 text-[#CCFF00]" /> Completado
              </>
            ) : (
              <Dumbbell className="h-5 w-5 text-[#CCFF00]" />
            )}
          </button>
          <button type="button" onClick={onToggleSubstitution} className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-400">
            <Repeat className="h-3 w-3" /> Sustituir
          </button>
          <button type="button" onClick={onToggleAvoided} className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-400">
            {isAvoided ? "Quitar evitar" : "Evitar"}
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-2xl bg-zinc-900 p-3">
          <p className="text-[10px] text-zinc-500 uppercase font-bold">Series</p>
          <p className="font-black">{item.target_sets || 3}</p>
        </div>
        <div className="rounded-2xl bg-zinc-900 p-3">
          <p className="text-[10px] text-zinc-500 uppercase font-bold">Reps</p>
          <p className="font-black">{item.target_reps || "10-12"}</p>
        </div>
        <div className="rounded-2xl bg-zinc-900 p-3">
          <p className="text-[10px] text-zinc-500 uppercase font-bold">Hechas</p>
          <p className="font-black">{localLogs.length}</p>
        </div>
      </div>

      {prescriptionSummary && <p className="mb-2 text-xs font-bold text-zinc-300">{prescriptionSummary}</p>}

      {item.notes && <p className="mb-2 text-xs text-zinc-400">{item.notes}</p>}

      {(item.progression_rule || item.substitution_criteria) && (
        <details className="mb-4 text-xs text-zinc-500">
          <summary className="cursor-pointer font-bold text-zinc-400">Más detalles</summary>
          {item.progression_rule && <p className="mt-2">Progresión: {item.progression_rule}</p>}
          {item.substitution_criteria && <p className="mt-1">Sustituir si: {item.substitution_criteria}</p>}
        </details>
      )}

      {isSubstitutingThis && (
        <SubstitutionPanel
          targetMuscle={exercise?.target_muscle || ""}
          isLoading={isLoadingSubstitutes}
          options={substituteOptions}
          isSubstituting={isSubstituting}
          favoriteExerciseIds={favoriteExerciseIds}
          onSelect={onSelectSubstitute}
          onCancel={onCancelSubstitution}
        />
      )}

      {suggestion && (
        <div className="mb-4 rounded-2xl border border-[#CCFF00]/30 bg-[#CCFF00]/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase font-bold text-[#CCFF00] inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Última vez ({formatRelativeDate(suggestion.lastDate)})
              </p>
              <p className="mt-1 text-sm font-bold text-white">
                {suggestion.lastWeight} kg × {suggestion.lastReps} reps
                {suggestion.lastRpe ? ` · RPE ${suggestion.lastRpe}` : ""}
              </p>
              <p className="mt-1 text-xs text-zinc-400">{suggestion.suggestionLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => onApplySuggestion(suggestion)}
              className="shrink-0 rounded-xl bg-[#CCFF00] px-3 py-2 text-xs font-black text-black"
            >
              Usar {suggestion.suggestedWeight} kg
            </button>
          </div>
        </div>
      )}

      {localLogs.length > 0 && (
        <button
          type="button"
          onClick={() => onCopyPreviousSet(localLogs[localLogs.length - 1])}
          className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-zinc-400"
        >
          <Repeat className="h-3 w-3" /> Copiar serie anterior
        </button>
      )}

      <SetLogger
        input={currentInput}
        onChange={onUpdateInput}
        onAdjustWeight={onAdjustWeight}
        onAdjustReps={onAdjustReps}
        onSubmit={onRegisterSet}
        isSaving={isSavingSet}
      />

      {localLogs.length > 0 && (
        <div className="mt-4 grid gap-2">
          {localLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded-xl bg-zinc-900 px-3 py-2 text-xs">
              <span className="text-zinc-400">
                Serie {log.set_number} {log.is_warmup && <span className="text-[#CCFF00]">· Calentamiento</span>}
              </span>
              <span className="font-bold text-white">
                {log.pending && <Clock className="inline h-3 w-3 mr-1 text-amber-400" />}
                {log.weight} kg × {log.reps} reps {log.rpe ? `• RPE ${log.rpe}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
