/**
 * whitepages.ts
 * Worker registry backed by Supabase Postgres.
 * Exports the same interface consumed by src/lib/mcp/server.ts.
 */

import { getSupabase } from "./client";

export interface HumanRecord {
  wallet: string;
  skills: string[];
  rate_usdc: number;
  availability: "available" | "busy" | "offline";
  reputation_score: number;
}

/**
 * searchBySkill
 * Returns humans whose skills array contains the search term.
 * Postgres array containment: skills @> ARRAY[skill].
 * Sorted by reputation_score desc, then rate_usdc asc.
 */
export async function searchBySkill(skill: string): Promise<HumanRecord[]> {
  const normalized = skill.toLowerCase().trim();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("humans")
    .select("wallet, skills, rate_usdc, availability, reputation_score")
    .contains("skills", [normalized])
    .order("reputation_score", { ascending: false })
    .order("rate_usdc", { ascending: true });

  if (error) throw new Error(`searchBySkill failed: ${error.message}`);
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
    .select("id, wallet, skills, rate_usdc, availability, reputation_score")
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
    .select("id, wallet, skills, rate_usdc, availability, reputation_score")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new Error(`getHumanById failed: ${error.message}`);
  }
  return (data as (HumanRecord & { id: string })) ?? null;
}

/**
 * getDistinctSkills
 * Returns the canonical skill taxonomy — all unique skills across all contractors.
 */
export async function getDistinctSkills(): Promise<string[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("humans")
    .select("skills");

  if (error) throw new Error(`getDistinctSkills failed: ${error.message}`);

  const skillSet = new Set<string>();
  for (const row of data ?? []) {
    for (const s of (row as { skills: string[] }).skills) {
      skillSet.add(s);
    }
  }
  return [...skillSet].sort();
}

/**
 * getAllHumans
 * Returns the full whitepages directory.
 */
export async function getAllHumans(): Promise<HumanRecord[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("humans")
    .select("wallet, skills, rate_usdc, availability, reputation_score")
    .order("reputation_score", { ascending: false });

  if (error) throw new Error(`getAllHumans failed: ${error.message}`);
  return (data ?? []) as HumanRecord[];
}
