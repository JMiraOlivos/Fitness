import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Cookie-backed browser client (via @supabase/ssr) so the session lives in cookies
// instead of localStorage. This lets middleware.ts and Server Components read the
// session server-side (they can't reach localStorage). The auth API surface is the
// same as the plain createClient, so getSession()/onAuthStateChange and the Bearer
// token flow to API routes keep working unchanged.
export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
