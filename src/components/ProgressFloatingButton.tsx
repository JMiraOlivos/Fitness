"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp } from "lucide-react";

export function ProgressFloatingButton() {
  const pathname = usePathname();

  if (pathname.startsWith("/progreso")) {
    return null;
  }

  return (
    <Link
      href="/progreso"
      className="fixed bottom-24 right-4 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 bg-[#CCFF00] text-black shadow-lg shadow-black/40 md:right-[calc(50%-14rem)]"
      aria-label="Ver progreso"
    >
      <TrendingUp className="h-6 w-6" />
    </Link>
  );
}
