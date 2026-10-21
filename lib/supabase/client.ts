"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

let client: SupabaseClient | undefined;

export function getSupabaseBrowserClient() {
  if (!client) {
    const { url, key } = getSupabaseConfig();
    client = createClient(url, key);
  }
  return client;
}
