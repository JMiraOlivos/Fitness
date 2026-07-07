import Link from "next/link";
import type { ActiveProgram } from "../types";

export function ActiveProgramCard({ program }: { program: ActiveProgram }) {
  return (
    <Link href={`/programas/${program.id}`} className="mb-6 block rounded-2xl border border-[#CCFF00]/40 bg-[#CCFF00]/10 p-4">
      <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Mesociclo activo</p>
      <p className="font-black mt-1">{program.name}</p>
      <p className="text-xs text-zinc-400 mt-1">
        Semana {program.currentWeek} de {program.duration_weeks}
        {program.nextWeekIsDeload ? " · próxima semana: deload" : ""}
      </p>
    </Link>
  );
}
