/**
 * whitepages.ts
 * Mock in-memory DB of humans registered on Base L2.
 * Replace with real Supabase/Postgres client when credentials are available.
 */

export interface HumanRecord {
  wallet: string;         // Base-checksum wallet address
  skills: string[];       // lowercase skill slugs
  rate_usdc: number;      // per-hour rate in USDC (6 decimals implied)
  availability: "available" | "busy" | "offline";
  reputation_score: number; // 0–100
}

const MOCK_WHITEPAGES: HumanRecord[] = [
  {
    wallet: "0xA1b2C3d4E5f6000000000000000000000000AAAA",
    skills: ["solidity", "smart-contracts", "auditing"],
    rate_usdc: 150,
    availability: "available",
    reputation_score: 97,
  },
  {
    wallet: "0xB2c3D4e5F6a7000000000000000000000000BBBB",
    skills: ["typescript", "nextjs", "api-design"],
    rate_usdc: 120,
    availability: "available",
    reputation_score: 91,
  },
  {
    wallet: "0xC3d4E5f6A7b8000000000000000000000000CCCC",
    skills: ["zk-proofs", "circom", "cryptography"],
    rate_usdc: 200,
    availability: "busy",
    reputation_score: 99,
  },
  {
    wallet: "0xD4e5F6a7B8c9000000000000000000000000DDDD",
    skills: ["python", "data-analysis", "ml"],
    rate_usdc: 100,
    availability: "available",
    reputation_score: 85,
  },
  {
    wallet: "0xE5f6A7b8C9d0000000000000000000000000EEEE",
    skills: ["solidity", "defi", "subgraph"],
    rate_usdc: 175,
    availability: "offline",
    reputation_score: 88,
  },
];

/**
 * searchBySkill
 * Returns all humans whose skill list includes the requested skill (case-insensitive substring match).
 * Sorted by reputation_score desc, then rate_usdc asc.
 */
export function searchBySkill(skill: string): HumanRecord[] {
  const normalized = skill.toLowerCase().trim();
  return MOCK_WHITEPAGES
    .filter((h) => h.skills.some((s) => s.includes(normalized)))
    .sort((a, b) =>
      b.reputation_score - a.reputation_score || a.rate_usdc - b.rate_usdc
    );
}

/**
 * getAllHumans
 * Returns the full whitepages directory.
 */
export function getAllHumans(): HumanRecord[] {
  return [...MOCK_WHITEPAGES];
}
