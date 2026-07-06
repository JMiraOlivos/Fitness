// Supabase's JS client types nested relations as `T | T[] | null` depending on the
// join, even for a to-one relation. This normalizes any of those shapes to `T | null`.
export function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}
