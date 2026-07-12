import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { ProgresoClient, type ProgresoSetLog } from "./ProgresoClient";

// Server Component initial fetch (vNext++ point 2 / roadmap item 9): streams the
// 90-day set_logs server-side so the client doesn't block on it. Reuses the same
// cookie-based auth as /historial (enabled by the cookie-backed browser client).
// Falls back gracefully — if there's no session server-side, the client component
// fetches everything itself exactly as before.
async function fetchInitialSetLogs() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return null;

    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: () => {},
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data } = await supabase
      .from("set_logs")
      .select(`
        id,
        workout_log_id,
        weight,
        reps,
        rpe,
        is_warmup,
        exercises ( id, name, target_muscle, equipment ),
        workout_logs!inner ( start_time )
      `)
      .gte("workout_logs.start_time", ninetyDaysAgo.toISOString())
      .order("id", { ascending: false });

    return (data || []) as unknown as ProgresoSetLog[];
  } catch {
    return null;
  }
}

export default function ProgresoPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white p-6 pb-16 font-sans max-w-md mx-auto flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#CCFF00]" />
        </main>
      }
    >
      <ProgresoContent />
    </Suspense>
  );
}

async function ProgresoContent() {
  const initialSetLogs = await fetchInitialSetLogs();
  return <ProgresoClient initialSetLogs={initialSetLogs} />;
}
