/**
 * whitepages.ts
 * Worker registry backed by Supabase Postgres.
 * Exports the same interface consumed by src/lib/mcp/server.ts.
 */

import { getSupabase } from "./client";

export interface HumanRecord {
  wallet: string;
  categories: string[];
  rate_usdc: number;
  availability: "available" | "busy" | "offline";
  reputation_score: number;
}

/**
 * searchByCategory
 * Returns humans whose categories array contains the search term.
 * Postgres array containment: categories @> ARRAY[category].
 * Sorted by reputation_score desc, then rate_usdc asc.
 */
export async function searchByCategory(category: string): Promise<HumanRecord[]> {
  const normalized = category.toLowerCase().trim();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("humans")
    .select("wallet, categories, rate_usdc, availability, reputation_score")
    .contains("categories", [normalized])
    .order("reputation_score", { ascending: false })
    .order("rate_usdc", { ascending: true });

  if (error) throw new Error(`searchByCategory failed: ${error.message}`);
  return (data ?? []) as HumanRecord[];
}

/**
 * getHumanByWallet
 * Returns a single contractor by wallet address, or null if not found.
 */
export async function getHumanByWallet(
  wallet: string
): Promise<(HumanRecord & { id: string }) | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("humans")
    .select("id, wallet, categories, rate_usdc, availability, reputation_score")
    .eq("wallet", wallet.toLowerCase())
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`getHumanByWallet failed: ${error.message}`);
  }
  return (data as (HumanRecord & { id: string })) ?? null;
}

/**
 * getHumanById
 * Returns a single contractor by UUID, or null if not found.
 */
export async function getHumanById(
  id: string
): Promise<(HumanRecord & { id: string }) | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("humans")
    .select("id, wallet, categories, rate_usdc, availability, reputation_score")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`getHumanById failed: ${error.message}`);
  }
  return (data as (HumanRecord & { id: string })) ?? null;
}

/**
 * getDistinctCategories
 * Returns the canonical category taxonomy — all unique categories across all contractors.
 */
export async function getDistinctCategories(): Promise<string[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("humans")
    .select("categories");

  if (error) throw new Error(`getDistinctCategories failed: ${error.message}`);

  const categorySet = new Set<string>();
  for (const row of data ?? []) {
    for (const c of (row as { categories: string[] }).categories) {
      categorySet.add(c);
    }
  }
  return [...categorySet].sort();
}

/**
 * getAllHumans
 * Returns the full whitepages directory.
 */
export async function getAllHumans(): Promise<HumanRecord[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("humans")
    .select("wallet, categories, rate_usdc, availability, reputation_score")
    .order("reputation_score", { ascending: false });

  if (error) throw new Error(`getAllHumans failed: ${error.message}`);
  return (data ?? []) as HumanRecord[];
}
