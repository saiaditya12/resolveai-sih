export function hasSupabaseConfiguration(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configured = [url, anonKey].filter(Boolean).length;
  if (configured === 1) {
    throw new Error(
      "Persistent mode requires both the Supabase URL and public anon key.",
    );
  }
  return configured === 2;
}

export function getPublicSupabaseConfig() {
  if (!hasSupabaseConfiguration())
    throw new Error("Supabase credentials are not configured.");
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  };
}
