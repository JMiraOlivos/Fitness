import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

// Routes that require an authenticated session. Everything else (/, /auth, static
// assets, the PWA shell) stays public. Admin routes still enforce profiles.is_admin
// via RLS inside the page; this guard only ensures there is *a* session first.
const PROTECTED_PREFIXES = [
  "/entrenar",
  "/historial",
  "/progreso",
  "/programas",
  "/perfil",
  "/onboarding",
  "/admin",
];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  // Standard Supabase SSR pattern: build a response we can mutate cookies on, then
  // let getUser() refresh the session and write the rotated tokens back.
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without env config we can't validate anything — fail open so local/dev without
  // Supabase keys still renders (the page-level client guards remain in place).
  if (!supabaseUrl || !supabaseAnonKey) return response;

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && isProtected(request.nextUrl.pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  // Run on everything except Next internals, static assets, the PWA files and icons.
  matcher: [
    "/((?!_next/static|_next/image|favicon.png|favicon.ico|manifest.json|sw.js|offline.html|icons/|icon.svg|robots.txt|sitemap.xml).*)",
  ],
};
