"use client";

import { useState } from "react";
import { BrainCircuit, Dumbbell, History, Loader2, Plus, Sparkles, TrendingUp } from "lucide-react";

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

export default function Dashboard() {
  const [diasDisponibles, setDiasDisponibles] = useState("4");
  const [enfoque, setEnfoque] = useState("Hipertrofia upper/lower");
  const [restricciones, setRestricciones] = useState("Sin dominadas, sin sentadillas búlgaras y priorizar poleas");
  const [rutinasIA, setRutinasIA] = useState<RutinaIA[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const routines = [
    { id: 1, title: "Upper A", focus: "Pecho/Espalda", exercises: 6 },
    { id: 2, title: "Lower A", focus: "Cuádriceps/Isquios", exercises: 5 },
    { id: 3, title: "Upper B", focus: "Poleas/Accesorios", exercises: 6 },
    { id: 4, title: "Lower B", focus: "Glúteos/Isquios", exercises: 5 },
  ];

  async function generarRutina() {
    setIsGenerating(true);
    setError(null);

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

      <section className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase font-bold">Volumen Semanal</p>
          <p className="text-2xl font-bold mt-1">42,500 <span className="text-[10px] text-zinc-400">kg</span></p>
        </div>
        <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase font-bold">Racha Actual</p>
          <p className="text-2xl font-bold mt-1">12 <span className="text-[10px] text-zinc-400">días</span></p>
        </div>
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
      </section>

      {rutinasIA.length > 0 && (
        <section className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold">Rutina generada</h3>
            <span className="text-xs text-zinc-500">{rutinasIA.length} días</span>
          </div>

          <div className="grid gap-4">
            {rutinasIA.map((rutina, index) => (
              <article key={`${rutina.titulo}-${index}`} className="bg-zinc-950 border border-zinc-800 rounded-3xl p-4">
                <div className="mb-4">
                  <p className="text-xs text-[#CCFF00] font-bold uppercase">Día {index + 1}</p>
                  <h4 className="text-xl font-black">{rutina.titulo}</h4>
                  <p className="text-sm text-zinc-400 mt-1">{rutina.descripcion}</p>
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
          <h3 className="text-lg font-bold">Mis Rutinas</h3>
          <button onClick={generarRutina} disabled={isGenerating} className="text-[#CCFF00] text-sm flex items-center gap-1 disabled:opacity-60">
            <Plus className="w-4 h-4" /> Nueva
          </button>
        </div>
        <div className="grid gap-4">
          {routines.map((routine) => (
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
        <button className="text-[#CCFF00] flex flex-col items-center gap-1">
          <Dumbbell className="w-6 h-6" />
          <span className="text-[10px] font-bold">Entrenar</span>
        </button>
        <button className="text-zinc-500 flex flex-col items-center gap-1">
          <TrendingUp className="w-6 h-6" />
          <span className="text-[10px] font-bold">Progreso</span>
        </button>
        <button className="text-zinc-500 flex flex-col items-center gap-1">
          <History className="w-6 h-6" />
          <span className="text-[10px] font-bold">Historial</span>
        </button>
      </nav>
    </div>
  );
}
