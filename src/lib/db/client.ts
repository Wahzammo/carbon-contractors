/**
 * client.ts
 * Singleton Supabase client for server-side use.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getConfig } from "@/lib/config";

let _client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (_client) return _client;

  const config = getConfig();
  _client = createClient<Database>(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  return _client;
}
