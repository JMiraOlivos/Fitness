"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft, CheckCircle2, Loader2, LogIn, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";

type AuthMode = "login" | "signup";

export default function AuthPage() {
  return (
    <Suspense>
      <AuthPageInner />
    </Suspense>
  );
}

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/";
  const [mode, setMode] = useState<AuthMode>("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setMessage(null);

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Ingresa tu email.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim() || cleanEmail,
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        if (data.session) {
          setMessage("Cuenta creada correctamente. Redirigiendo...");
          router.replace(nextPath);
          return;
        }

        setMessage("Cuenta creada. Si Supabase tiene confirmación de email activada, revisa tu correo antes de iniciar sesión.");
        setMode("login");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      setMessage("Sesión iniciada correctamente. Redirigiendo...");
      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos completar la autenticación.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 max-w-md mx-auto flex flex-col">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 mb-8">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
        <p className="text-xs text-[#CCFF00] uppercase font-bold tracking-wider">Cuenta</p>
        <h1 className="text-3xl font-black tracking-tight mt-1">
          {mode === "signup" ? "Crear usuario" : "Iniciar sesión"}
        </h1>
        <p className="text-sm text-zinc-400 mt-2">
          {mode === "signup"
            ? "Crea una cuenta con email y contraseña para guardar rutinas y entrenamientos."
            : "Ingresa con tu email y contraseña para continuar tu progreso."}
        </p>

        <div className="grid grid-cols-2 gap-2 mt-6 rounded-2xl bg-black p-1 border border-zinc-800">
          <button
            onClick={() => setMode("signup")}
            className={`rounded-xl px-3 py-2 text-sm font-bold transition-colors ${mode === "signup" ? "bg-[#CCFF00] text-black" : "text-zinc-400"}`}
          >
            Crear cuenta
          </button>
          <button
            onClick={() => setMode("login")}
            className={`rounded-xl px-3 py-2 text-sm font-bold transition-colors ${mode === "login" ? "bg-[#CCFF00] text-black" : "text-zinc-400"}`}
          >
            Ingresar
          </button>
        </div>

        <div className="grid gap-3 mt-5">
          {mode === "signup" && (
            <label className="grid gap-1 text-sm">
              <span className="text-zinc-400">Nombre</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Tu nombre"
                className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]"
              />
            </label>
          )}

          <label className="grid gap-1 text-sm">
            <span className="text-zinc-400">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="tu@email.com"
              className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-zinc-400">Contraseña</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="Mínimo 6 caracteres"
              className="bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 outline-none focus:border-[#CCFF00]"
            />
          </label>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === "signup" ? <UserPlus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
            {isSubmitting ? "Procesando..." : mode === "signup" ? "Crear usuario" : "Iniciar sesión"}
          </button>
        </div>

        {message && (
          <div className="mt-4 rounded-2xl border border-lime-900/60 bg-lime-950/40 p-4 text-sm text-lime-200 inline-flex gap-2">
            <CheckCircle2 className="h-5 w-5 shrink-0" /> {message}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
            {error}
          </div>
        )}
      </section>

      <p className="text-xs text-zinc-600 mt-5 leading-relaxed">
        Para un MVP sin redirects, desactiva temporalmente la confirmación de email en Supabase Auth. Más adelante podemos volver a activarla con callback dedicado.
      </p>
    </main>
  );
}
