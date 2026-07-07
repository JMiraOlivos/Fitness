import Link from "next/link";
import { Sparkles } from "lucide-react";

export function OnboardingBanner() {
  return (
    <Link href="/onboarding" className="mb-6 block rounded-2xl border border-[#CCFF00]/40 bg-[#CCFF00]/10 p-4">
      <p className="inline-flex items-center gap-2 font-black text-[#CCFF00]">
        <Sparkles className="h-4 w-4" /> Completa tu perfil
      </p>
      <p className="mt-1 text-xs text-zinc-300">
        Cuéntanos tu objetivo, nivel y equipo en menos de 2 minutos y te generamos tu primer plan.
      </p>
    </Link>
  );
}
