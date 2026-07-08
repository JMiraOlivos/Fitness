"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3, CheckCircle2, Loader2, ThumbsDown, ThumbsUp, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/components/SessionProvider";

type AiGeneration = {
  id: string;
  user_id: string | null;
  type: string;
  model: string;
  prompt_version: string;
  schema_version: string;
  latency_ms: number | null;
  success: boolean;
  error: string | null;
  user_feedback: string | null;
  created_at: string;
  input: any;
  output: any;
};

const TYPE_LABELS: Record<string, string> = {
  routine_generation: "Generación de rutina",
  routine_regeneration: "Regeneración de día",
  workout_insight: "Insight post-entrenamiento",
};

export default function AdminAiPage() {
  const { user, isLoading: isSessionLoading } = useSession();
  const [generations, setGenerations] = useState<AiGeneration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (isSessionLoading) return;
    if (!user) { setIsLoading(false); return; }
    void cargar();
  }, [user, isSessionLoading, filter]);

  async function cargar() {
    setIsLoading(true);
    let query = supabase.from("ai_generations").select("*").order("created_at", { ascending: false }).limit(50);
    if (filter !== "all") query = query.eq("type", filter);
    const { data } = await query;
    setGenerations((data || []) as unknown as AiGeneration[]);
    setIsLoading(false);
  }

  if (isSessionLoading || isLoading) {
    return <main className="min-h-screen bg-black text-white p-6 max-w-md mx-auto flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#CCFF00]" /></main>;
  }

  if (!user) {
    return <main className="min-h-screen bg-black text-white p-6 max-w-md mx-auto"><Link href="/auth" className="text-[#CCFF00] font-bold">Iniciar sesión</Link></main>;
  }

  const total = generations.length;
  const successCount = generations.filter((g) => g.success).length;
  const avgLatency = generations.filter((g) => g.latency_ms).reduce((s, g) => s + (g.latency_ms || 0), 0) / (total || 1);
  const thumbsUp = generations.filter((g) => g.user_feedback === "thumbs_up").length;
  const thumbsDown = generations.filter((g) => g.user_feedback === "thumbs_down").length;

  return (
    <main className="min-h-screen bg-black text-white p-6 pb-16 font-sans max-w-md mx-auto">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-6"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>

      <header className="mb-6">
        <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Admin</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">Panel de IA</h1>
        <p className="text-sm text-zinc-400 mt-2">Audita la calidad de las generaciones de IA.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-[10px] text-zinc-500 uppercase font-bold">Generaciones</p>
          <p className="text-xl font-black mt-1">{total}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-[10px] text-zinc-500 uppercase font-bold">Tasa éxito</p>
          <p className="text-xl font-black mt-1">{total > 0 ? Math.round((successCount / total) * 100) : 0}%</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-[10px] text-zinc-500 uppercase font-bold">Latencia p50</p>
          <p className="text-xl font-black mt-1">{Math.round(avgLatency)}ms</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-[10px] text-zinc-500 uppercase font-bold">Feedback</p>
          <p className="text-xl font-black mt-1 inline-flex items-center gap-1">
            <ThumbsUp className="h-4 w-4 text-[#CCFF00]" /> {thumbsUp} <ThumbsDown className="h-4 w-4 text-red-400 ml-1" /> {thumbsDown}
          </p>
        </div>
      </section>

      <section className="mb-6 flex gap-2">
        {["all", "routine_generation", "routine_regeneration", "workout_insight"].map((type) => (
          <button key={type} onClick={() => setFilter(type)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${filter === type ? "bg-[#CCFF00] text-black" : "bg-zinc-900 text-zinc-400"}`}>
            {type === "all" ? "Todas" : TYPE_LABELS[type] || type}
          </button>
        ))}
      </section>

      <section className="grid gap-3">
        {generations.map((gen) => (
          <article key={gen.id} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-[#CCFF00]">{TYPE_LABELS[gen.type] || gen.type}</span>
                  {gen.success ? <CheckCircle2 className="h-3 w-3 text-lime-400" /> : <XCircle className="h-3 w-3 text-red-400" />}
                  {gen.user_feedback === "thumbs_up" && <ThumbsUp className="h-3 w-3 text-[#CCFF00]" />}
                  {gen.user_feedback === "thumbs_down" && <ThumbsDown className="h-3 w-3 text-red-400" />}
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  {gen.model} · v{gen.prompt_version} · {gen.latency_ms ? `${gen.latency_ms}ms` : "?"} · {new Date(gen.created_at).toLocaleDateString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
                {gen.error && <p className="text-xs text-red-400 mt-1">{gen.error}</p>}
              </div>
              <button onClick={() => setExpandedId(expandedId === gen.id ? null : gen.id)} className="text-[10px] font-bold text-zinc-500 shrink-0">
                {expandedId === gen.id ? "Colapsar" : "Detalle"}
              </button>
            </div>
            {expandedId === gen.id && (
              <div className="mt-3 border-t border-zinc-800 pt-3">
                <details className="mb-2"><summary className="text-xs font-bold text-zinc-400 cursor-pointer">Input</summary><pre className="mt-1 text-[10px] text-zinc-500 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(gen.input, null, 2)}</pre></details>
                <details><summary className="text-xs font-bold text-zinc-400 cursor-pointer">Output</summary><pre className="mt-1 text-[10px] text-zinc-500 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(gen.output, null, 2)}</pre></details>
              </div>
            )}
          </article>
        ))}
      </section>

      {generations.length === 0 && (
        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 text-center">
          <BarChart3 className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
          <h2 className="text-lg font-bold">Sin registros</h2>
          <p className="text-sm text-zinc-400 mt-1">No hay generaciones de IA para mostrar.</p>
        </section>
      )}
    </main>
  );
}
