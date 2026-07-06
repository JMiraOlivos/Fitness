"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, History, Home, TrendingUp } from "lucide-react";

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

  if (pathname.startsWith("/auth")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-w-md items-center justify-between border-t border-zinc-800 bg-zinc-950/95 px-6 py-3 text-xs backdrop-blur-md">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);

        return (
          <Link key={item.href} href={item.href} className={`flex flex-1 flex-col items-center gap-1 font-bold ${active ? "text-[#CCFF00]" : "text-zinc-500"}`}>
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
