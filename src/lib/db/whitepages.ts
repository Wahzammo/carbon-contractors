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
