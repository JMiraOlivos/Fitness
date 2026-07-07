import Link from "next/link";
import { LogOut, UserCog } from "lucide-react";
import type { User } from "@supabase/supabase-js";

type AccountCardProps = {
  user: User | null;
  onSignOut: () => void;
};

export function AccountCard({ user, onSignOut }: AccountCardProps) {
  return (
    <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Cuenta</p>
          <h2 className="text-lg font-bold">{user ? "Sesión activa" : "Crea tu usuario"}</h2>
          <p className="text-xs text-zinc-500 mt-1">{user ? user.email : "Usa email y contraseña para guardar progreso."}</p>
        </div>
        {user ? (
          <div className="flex items-center gap-2">
            <Link href="/perfil" className="rounded-full bg-zinc-900 p-3 text-zinc-400">
              <UserCog className="h-5 w-5" />
            </Link>
            <button onClick={onSignOut} className="rounded-full bg-zinc-900 p-3 text-zinc-400">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <Link href="/auth" className="rounded-full bg-[#CCFF00] px-4 py-2 text-xs font-black text-black">
            Ingresar
          </Link>
        )}
      </div>
    </section>
  );
}
