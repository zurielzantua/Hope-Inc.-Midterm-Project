import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd(), true);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const table = process.env.SUPABASE_CHECK_TABLE || "product";

if (!url || !key || key.startsWith("sb_secret_")) {
  console.error("Configure the Supabase URL and publishable/anon key in .env.local. Secret keys are not supported.");
  process.exit(1);
}
if (!/^[a-z_][a-z0-9_]*$/i.test(table)) {
  console.error("SUPABASE_CHECK_TABLE must be a plain public table name.");
  process.exit(1);
}

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
});

// HEAD requests validate the database API without fetching or printing business records.
const { error, status } = await client.from(table).select("*", { head: true }).limit(1);
if (error) {
  console.error(`Database check failed for ${table} (HTTP ${status}, ${error.code || "network error"}).`);
  console.error("Ask the DB Admin to confirm the table exists, Data API grants, and RLS policies. Do not disable RLS for this check.");
  process.exitCode = 1;
} else {
  console.log(`Supabase database API connection verified: ${table} (HTTP ${status}).`);
  console.log("No records were fetched or modified. This does not verify authenticated user permissions.");
}
