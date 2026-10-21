import { createSupabasePublicServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // Setup diagnostic only; do not expose database diagnostics in production.
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  const headers = { "Cache-Control": "no-store" };
  const table = process.env.SUPABASE_CHECK_TABLE || "product";
  if (!/^[a-z_][a-z0-9_]*$/i.test(table)) {
    return Response.json({ connected: false }, { status: 503, headers });
  }

  try {
    const client = createSupabasePublicServerClient();
    const { error } = await client.from(table).select("*", { head: true }).limit(1)
      .abortSignal(AbortSignal.timeout(15000));
    return Response.json({ connected: !error }, { status: error ? 503 : 200, headers });
  } catch {
    return Response.json({ connected: false }, { status: 503, headers });
  }
}
