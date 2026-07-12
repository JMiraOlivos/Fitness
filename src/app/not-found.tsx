import Link from "next/link";
import { Dumbbell, Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-black text-white p-6 pb-28 font-sans max-w-md mx-auto flex flex-col items-center justify-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950">
        <Dumbbell className="h-8 w-8 text-[#CCFF00]" />
      </div>
      <p className="mt-6 text-xs font-bold uppercase tracking-wider text-[#CCFF00]">Error 404</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight">Página no encontrada</h1>
      <p className="mt-2 text-sm text-zinc-400">
        La ruta que buscas no existe o se movió. Volvamos a tu entrenamiento.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#CCFF00] px-5 py-3 font-black text-black"
      >
        <Home className="h-5 w-5" /> Volver al inicio
      </Link>
    </main>
  );
}
