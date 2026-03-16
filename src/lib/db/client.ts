/**
 * client.ts
 * Singleton Supabase client for server-side use.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let _client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables",
    );
  }

  _client = createClient<Database>(url, key);
  return _client;
}
