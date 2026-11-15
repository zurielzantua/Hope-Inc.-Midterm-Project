import { createClient } from "@supabase/supabase-js";
import { handleRegistrationRequest } from "@/lib/supabase/registration";

export async function POST(request: Request) {
  return handleRegistrationRequest(request, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  }, (url, secretKey, publicKey) => {
    if (secretKey === publicKey || secretKey.startsWith("sb_publishable_")) {
      throw new Error("A server-only Supabase secret key is required.");
    }
    return createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  });
}
