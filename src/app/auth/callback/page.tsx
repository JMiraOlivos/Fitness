"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Validando tu sesión...");

  useEffect(() => {
    async function finishSignIn() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (!data.session) {
          setStatus("error");
          setMessage("No pudimos encontrar una sesión activa. Vuelve al dashboard y solicita un nuevo magic link.");
          return;
        }

        setStatus("success");
        setMessage("Sesión iniciada correctamente. Redirigiendo al dashboard...");

        window.setTimeout(() => {
          router.replace("/");
        }, 900);
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "No pudimos completar el inicio de sesión.");
      }
    }

    void finishSignIn();
  }, [router]);

  return (
    <main className="min-h-screen bg-black text-white p-6 max-w-md mx-auto flex items-center justify-center">
      <section className="w-full rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center">
        {status === "loading" && <Loader2 className="h-10 w-10 animate-spin text-[#CCFF00] mx-auto" />}
        {status === "success" && <CheckCircle2 className="h-10 w-10 text-[#CCFF00] mx-auto" />}
        {status === "error" && <XCircle className="h-10 w-10 text-red-400 mx-auto" />}

        <h1 className="mt-5 text-2xl font-black">Magic link</h1>
        <p className="mt-2 text-sm text-zinc-400">{message}</p>

        {status === "error" && (
          <button
            onClick={() => router.replace("/")}
            className="mt-5 w-full rounded-2xl bg-[#CCFF00] px-4 py-3 font-black text-black"
          >
            Volver al dashboard
          </button>
        )}
      </section>
    </main>
  );
}
