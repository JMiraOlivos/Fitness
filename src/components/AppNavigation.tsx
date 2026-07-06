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
  if (href === "/") {
    return pathname === "/";
  }

  return pathname.startsWith(href);
}

export function AppNavigation() {
  const pathname = usePathname();

  if (pathname.startsWith("/auth")) {
    return null;
  }

  if (pathname === "/") {
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

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-w-md items-center justify-between border-t border-zinc-800 bg-zinc-950/95 px-6 py-3 text-xs text-zinc-500 backdrop-blur-md">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 font-bold ${active ? "text-[#CCFF00]" : "text-zinc-500"}`}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
