import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { HistorialClient } from "./HistorialClient";

const PAGE_SIZE = 20;

async function fetchInitialWorkouts() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) return { workouts: [], hasMore: false, hasUser: false };

    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => cookieStore.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: () => {},
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { workouts: [], hasMore: false, hasUser: false };

    const { data } = await supabase
      .from("workout_logs")
      .select("id, start_time, end_time, ai_insight, routines ( title ), set_logs ( weight, reps, is_warmup )")
      .order("start_time", { ascending: false })
      .range(0, PAGE_SIZE - 1);

    return { workouts: (data || []) as any[], hasMore: (data || []).length === PAGE_SIZE, hasUser: true };
  } catch {
    return { workouts: [], hasMore: false, hasUser: false };
  }
}

export default function HistorialPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-black text-white p-6 pb-16 font-sans max-w-md mx-auto flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#CCFF00]" />
      </main>
    }>
      <HistorialContent />
    </Suspense>
  );
}

async function HistorialContent() {
  const { workouts, hasMore, hasUser } = await fetchInitialWorkouts();
  return <HistorialClient initialWorkouts={workouts} hasMoreInitial={hasMore} hasUser={hasUser} />;
}
