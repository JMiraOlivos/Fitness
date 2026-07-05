import { BrainCircuit, Dumbbell, History, Plus, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const routines = [
    { id: 1, title: "Upper A", focus: "Pecho/Espalda", exercises: 6 },
    { id: 2, title: "Lower A", focus: "Cuádriceps/Isquios", exercises: 5 },
    { id: 3, title: "Upper B", focus: "Poleas/Accesorios", exercises: 6 },
    { id: 4, title: "Lower B", focus: "Glúteos/Isquios", exercises: 5 },
  ];

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-24 font-sans max-w-md mx-auto">
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
        <div className="bg-gradient-to-br from-[#CCFF00] to-[#99cc00] p-6 rounded-3xl text-black relative overflow-hidden group active:scale-95 transition-transform cursor-pointer">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <BrainCircuit className="w-5 h-5" />
              <span className="font-bold uppercase text-xs tracking-wider">Coach IA Activo</span>
            </div>
            <h2 className="text-xl font-black leading-tight mb-2">&quot;Tu progreso en Press de Banca sugiere un aumento de 2.5kg hoy&quot;</h2>
            <button className="bg-black text-white px-4 py-2 rounded-full text-xs font-bold mt-2">
              Ver Análisis Detallado
            </button>
          </div>
          <BrainCircuit className="absolute -right-4 -bottom-4 w-32 h-32 text-black/10 rotate-12" />
        </div>
      </section>

      <section className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Mis Rutinas</h3>
          <button className="text-[#CCFF00] text-sm flex items-center gap-1">
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
              <button className="p-2 bg-zinc-800 rounded-full text-zinc-400">
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
