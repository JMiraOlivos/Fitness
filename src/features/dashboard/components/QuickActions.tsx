import Link from "next/link";
import { History, Play, TrendingUp } from "lucide-react";

export function QuickActions() {
  return (
    <section className="grid grid-cols-2 gap-3 mb-8">
      <Link href="/entrenar" className="rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black inline-flex items-center justify-center gap-2">
        <Play className="h-5 w-5" /> Entrenar
      </Link>
      <Link
        href="/historial"
        className="rounded-2xl bg-zinc-900 px-4 py-3 font-black text-white inline-flex items-center justify-center gap-2 border border-zinc-800"
      >
        <History className="h-5 w-5" /> Historial
      </Link>
      <Link
        href="/progreso"
        className="col-span-2 rounded-2xl bg-zinc-950 px-4 py-3 font-black text-white inline-flex items-center justify-center gap-2 border border-zinc-800"
      >
        <TrendingUp className="h-5 w-5 text-[#CCFF00]" /> Ver progreso
      </Link>
    </section>
  );
}
