import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

// Public, anonymous queries only. Cookie-based authenticated sessions belong to DEV-03.
export function createSupabasePublicServerClient() {
  const { url, key } = getSupabaseConfig();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
