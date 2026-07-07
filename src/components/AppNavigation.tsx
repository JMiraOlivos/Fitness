"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CloudOff, Dumbbell, History, Home, TrendingUp } from "lucide-react";
import { useConnectivity } from "@/lib/offline/useConnectivity";
import { fetchUnreadCoachCount } from "@/features/dashboard/data/dashboardQueries";

const navItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/entrenar", label: "Entrenar", icon: Dumbbell },
  { href: "/historial", label: "Historial", icon: History },
  { href: "/progreso", label: "Progreso", icon: TrendingUp },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppNavigation() {
  const pathname = usePathname();
  const { isOnline, pendingCount } = useConnectivity();
  const [unreadCoachCount, setUnreadCoachCount] = useState(0);

  useEffect(() => {
    fetchUnreadCoachCount().then(setUnreadCoachCount).catch(() => {});
  }, [pathname]);

  if (pathname.startsWith("/auth")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-w-md items-center justify-between border-t border-zinc-800 bg-zinc-950/95 px-6 py-3 text-xs backdrop-blur-md">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);

        return (
          <Link key={item.href} href={item.href} className={`relative flex flex-1 flex-col items-center gap-1 font-bold ${active ? "text-[#CCFF00]" : "text-zinc-500"}`}>
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
      {!isOnline && (
        <span className="flex flex-col items-center gap-1 text-amber-500 font-bold" title="Sin conexión">
          <CloudOff className="h-5 w-5" />
          <span className="text-[9px]">{pendingCount > 0 ? pendingCount : "Off"}</span>
        </span>
      )}
    </nav>
  );
}
