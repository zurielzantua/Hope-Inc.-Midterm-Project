import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

// Public, anonymous queries only. Cookie-based authenticated sessions belong to DEV-03.
export function createSupabasePublicServerClient() {
  const { url, key } = getSupabaseConfig();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function createSupabaseAdminClient(url: string, secretKey: string, publicKey?: string) {
  if (!secretKey || secretKey === publicKey || secretKey.startsWith("sb_publishable_")) {
    throw new Error("A server-only Supabase secret key is required.");
  }

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
}
