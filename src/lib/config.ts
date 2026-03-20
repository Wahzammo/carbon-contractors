/**
 * config.ts
 * Centralized, Zod-validated environment configuration.
 * Validates on first access and caches the result.
 */

import { z } from "zod";

const envSchema = z.object({
  // ── Required ──────────────────────────────────────────────────────────────
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_ONCHAINKIT_API_KEY: z.string().min(1),

  // ── Network ───────────────────────────────────────────────────────────────
  NEXT_PUBLIC_BASE_NETWORK: z
    .enum(["testnet", "mainnet"])
    .default("testnet"),

  // ── Contracts (optional — may not be deployed yet) ────────────────────────
  NEXT_PUBLIC_ESCROW_CONTRACT: z.string().optional(),
  NEXT_PUBLIC_REPUTATION_STAKE_CONTRACT: z.string().optional(),
  BASE_SEPOLIA_RPC_URL: z.string().optional(),

  // ── x402 / Platform ───────────────────────────────────────────────────────
  NEXT_PUBLIC_BASE_URL: z.string().default("http://localhost:3000"),
  PLATFORM_WALLET_ADDRESS: z.string().optional(),

  // ── Deploy (optional — only needed for Hardhat scripts) ───────────────────
  DEPLOYER_PRIVATE_KEY: z.string().optional(),
  CDP_API_KEY: z.string().optional(),

  // ── Session management ────────────────────────────────────────────────────
  SESSION_TIMEOUT_MS: z.coerce.number().default(1_800_000), // 30 min
  MAX_SESSIONS: z.coerce.number().default(100),

  // ── Rate limiting ─────────────────────────────────────────────────────────
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000), // 1 min
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(60),
});

export type AppConfig = z.infer<typeof envSchema>;

let _config: AppConfig | null = null;

/**
 * Returns the validated config, parsing env vars on first call.
 * Throws a descriptive error if required vars are missing.
 */
export function getConfig(): AppConfig {
  if (_config) return _config;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  _config = Object.freeze(result.data) as AppConfig;
  return _config;
}
