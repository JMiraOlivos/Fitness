import Link from "next/link";
import { Dumbbell, History, Loader2, Play, Trash2 } from "lucide-react";
import { one } from "@/lib/supabaseJoins";
import type { RutinaGuardada } from "../types";

function EmptyState({ title, text, href, action }: { title: string; text: string; href?: string; action?: string }) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
      <h4 className="text-xl font-black">{title}</h4>
      <p className="text-sm text-zinc-400 mt-2">{text}</p>
      {href && action && (
        <Link href={href} className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black">
          {action}
        </Link>
      )}
    </div>
  );
}

type SavedRoutinesProps = {
  hasUser: boolean;
  rutinas: RutinaGuardada[];
  isLoading: boolean;
  onRefresh: () => void;
  confirmingDeleteId: string | null;
  onToggleConfirmDelete: (id: string | null) => void;
  isDeleting: boolean;
  onDelete: (rutina: RutinaGuardada) => void;
};

export function SavedRoutines({
  hasUser,
  rutinas,
  isLoading,
  onRefresh,
  confirmingDeleteId,
  onToggleConfirmDelete,
  isDeleting,
  onDelete,
}: SavedRoutinesProps) {
  return (
    <section className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Rutinas guardadas</h3>
        <button onClick={onRefresh} disabled={!hasUser || isLoading} className="text-[#CCFF00] text-sm flex items-center gap-1 disabled:opacity-40">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
          Actualizar
        </button>
      </div>

      {!hasUser && <EmptyState title="Inicia sesión" text="Crea usuario o ingresa para ver tus rutinas guardadas." href="/auth" action="Ir a login" />}
      {hasUser && rutinas.length === 0 && !isLoading && (
        <EmptyState title="Sin rutinas guardadas" text="Genera tu primera rutina con IA y guárdala para entrenar." />
      )}

      <div className="grid gap-4">
        {rutinas.map((rutina) => (
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
                  onClick={() => onToggleConfirmDelete(confirmingDeleteId === rutina.id ? null : rutina.id)}
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
                    onClick={() => onDelete(rutina)}
                    className="flex-1 rounded-xl bg-red-500/90 py-2 font-bold text-black disabled:opacity-50"
                  >
                    {isDeleting ? "Borrando..." : "Sí, borrar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleConfirmDelete(null)}
                    className="flex-1 rounded-xl bg-zinc-900 py-2 font-bold text-zinc-300"
                  >
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
                    <span className="text-zinc-500">
                      {item.target_sets || 3}x {item.target_reps || "10-12"}
                    </span>
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
  );
}
