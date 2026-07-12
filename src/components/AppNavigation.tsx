"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bike,
  CloudOff,
  Droplet,
  Dumbbell,
  History,
  Home,
  LayoutGrid,
  Menu,
  Scale,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import { useConnectivity } from "@/lib/offline/useConnectivity";
import { fetchUnreadCoachCount } from "@/features/dashboard/data/dashboardQueries";

const navItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/entrenar", label: "Entrenar", icon: Dumbbell },
  { href: "/historial", label: "Historial", icon: History },
  { href: "/progreso", label: "Progreso", icon: TrendingUp },
];

// Secondary destinations that used to be unreachable from the tab bar (cardio was a
// fully orphan route, programas/peso/perfil only reachable via a small gear icon).
const moreItems = [
  { href: "/programas", label: "Programas", icon: LayoutGrid, description: "Mesociclos y planificación" },
  { href: "/progreso/cardio", label: "Cardio", icon: Bike, description: "Correr, bici, natación…" },
  { href: "/progreso/nutricion", label: "Nutrición", icon: Droplet, description: "Agua, proteína, calorías" },
  { href: "/progreso/peso", label: "Peso corporal", icon: Scale, description: "Peso y medidas" },
  { href: "/perfil", label: "Perfil", icon: User, description: "Objetivo, equipo, lesiones" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppNavigation() {
  const pathname = usePathname();
  const { isOnline, pendingCount } = useConnectivity();
  const [unreadCoachCount, setUnreadCoachCount] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    fetchUnreadCoachCount().then(setUnreadCoachCount).catch(() => {});
  }, [pathname]);

  // Close the "Más" sheet whenever the route changes.
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  if (pathname.startsWith("/auth")) return null;

  const moreActive = moreItems.some((item) => isActive(pathname, item.href));

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-40 mx-auto max-w-md" role="dialog" aria-modal="true" aria-label="Más secciones">
          <button
            aria-label="Cerrar menú"
            className="absolute inset-0 h-full w-full bg-black/70 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-[68px] left-0 right-0 rounded-t-3xl border-t border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Más secciones</p>
              <button aria-label="Cerrar" onClick={() => setMoreOpen(false)} className="p-1 text-zinc-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${active ? "border-[#CCFF00] bg-[#CCFF00]/10" : "border-zinc-800 bg-black"}`}
                  >
                    <Icon className={`h-5 w-5 ${active ? "text-[#CCFF00]" : "text-zinc-300"}`} />
                    <span className="flex flex-col">
                      <span className="text-sm font-bold text-white">{item.label}</span>
                      <span className="text-[11px] text-zinc-500">{item.description}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-w-md items-center justify-between border-t border-zinc-800 bg-zinc-950/95 px-4 py-3 text-xs backdrop-blur-md">
        {!isOnline && (
          <span
            className="absolute -top-3 right-4 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black text-black"
            title="Sin conexión"
          >
            <CloudOff className="h-3 w-3" />
            {pendingCount > 0 ? `${pendingCount} pend.` : "Offline"}
          </span>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);

          return (
            <Link key={item.href} href={item.href} className={`relative flex flex-1 flex-col items-center gap-1 font-bold ${active ? "text-[#CCFF00]" : "text-zinc-400"}`}>
              <Icon className="h-5 w-5" />
              {item.href === "/" && unreadCoachCount > 0 && (
                <span className="absolute -top-1 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
                  {unreadCoachCount > 9 ? "9+" : unreadCoachCount}
                </span>
              )}
              <span>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-label="Más secciones"
          aria-expanded={moreOpen}
          className={`flex flex-1 flex-col items-center gap-1 font-bold ${moreActive || moreOpen ? "text-[#CCFF00]" : "text-zinc-400"}`}
        >
          <Menu className="h-5 w-5" />
          <span>Más</span>
        </button>
      </nav>
    </>
  );
}
