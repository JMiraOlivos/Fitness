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

  // getUser() validates against the Auth server and, as a side effect, refreshes
  // and rewrites rotated tokens into `response`. We keep calling it for that
  // refresh, but it must NOT be the sole gate for the redirect: it's a network
  // call on every navigation, and on a flaky mobile connection (or the edge
  // runtime) a transient failure makes it return null even for a signed-in user.
  // Redirecting on that bounced logged-in users on installed PWAs back to /auth
  // on every page ("me pide auth pero no guarda la sesión").
  const { data: { user } } = await supabase.auth.getUser();

  // A request that carries a Supabase auth cookie belongs to a client that signed
  // in. Trust that presence for the redirect decision so a momentary getUser()
  // miss doesn't eject the user — real data access is still gated by RLS
  // server-side and by each page's own signed-out guard, and a genuinely stale
  // cookie is cleared by getUser() (via setAll into `response`) so it self-heals
  // on the next navigation. Only a truly anonymous request (no auth cookie at all)
  // gets sent to /auth.
  const hasAuthCookie = request.cookies
    .getAll()
    .some(({ name }) => /^sb-.*-auth-token(\.\d+)?$/.test(name));

  if (!user && !hasAuthCookie && isProtected(request.nextUrl.pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth";
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    const redirect = NextResponse.redirect(redirectUrl);
    // Carry over any cookies getUser() rotated/cleared onto the redirect response
    // so the browser and server stay in sync (Supabase SSR guidance: a freshly
    // created response must inherit the mutated cookies).
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  // Run on everything except Next internals, static assets, the PWA files and icons.
  matcher: [
    "/((?!_next/static|_next/image|favicon.png|favicon.ico|manifest.json|sw.js|offline.html|icons/|icon.svg|robots.txt|sitemap.xml).*)",
  ],
};
