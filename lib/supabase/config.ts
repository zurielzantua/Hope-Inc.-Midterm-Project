export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart Next.js.");
  }
  if (key.startsWith("sb_secret_")) {
    throw new Error("Use a Supabase publishable or legacy anon key, never a secret key.");
  }

  return { url, key };
}
