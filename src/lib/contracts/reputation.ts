/**
 * reputation.ts
 * Server-side read-only client for the ReputationStake contract.
 * Uses viem's publicClient to query on-chain stake state.
 *
 * Write operations (stake, unstake) happen client-side via the
 * worker's connected wallet. Slash is called by the platform owner.
 */

import { createPublicClient, http, type Address } from "viem";
import { baseSepolia, base } from "viem/chains";
import { REPUTATION_STAKE_ABI } from "./reputation-abi";

// ── Config ──────────────────────────────────────────────────────────────────

const chain =
  process.env.NEXT_PUBLIC_BASE_NETWORK === "mainnet" ? base : baseSepolia;

const REPUTATION_STAKE_ADDRESS = process.env
  .NEXT_PUBLIC_REPUTATION_STAKE_CONTRACT as Address | undefined;

const rpcUrl =
  process.env.BASE_SEPOLIA_RPC_URL ?? chain.rpcUrls.default.http[0];

// ── Public client (read-only, server-side) ──────────────────────────────────

const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

// ── Types ───────────────────────────────────────────────────────────────────

export interface WorkerStake {
  amount: bigint;
  stakedAt: bigint;
  slashedTotal: bigint;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getStakeAddress(): Address {
  if (!REPUTATION_STAKE_ADDRESS) {
    throw new Error(
      "NEXT_PUBLIC_REPUTATION_STAKE_CONTRACT not set. Deploy the contract first."
    );
  }
  return REPUTATION_STAKE_ADDRESS;
}

// ── Read functions ──────────────────────────────────────────────────────────

/**
 * Read a worker's on-chain stake info.
 */
export async function getWorkerStake(wallet: string): Promise<WorkerStake> {
  const result = await publicClient.readContract({
    address: getStakeAddress(),
    abi: REPUTATION_STAKE_ABI,
    functionName: "getStake",
    args: [wallet as Address],
  });

  return {
    amount: result[0],
    stakedAt: result[1],
    slashedTotal: result[2],
  };
}

/**
 * Get total USDC staked across all workers.
 */
export async function getTotalStaked(): Promise<bigint> {
  return publicClient.readContract({
    address: getStakeAddress(),
    abi: REPUTATION_STAKE_ABI,
    functionName: "totalStaked",
  });
}

/**
 * Get the current minimum stake amount.
 */
export async function getMinStake(): Promise<bigint> {
  return publicClient.readContract({
    address: getStakeAddress(),
    abi: REPUTATION_STAKE_ABI,
    functionName: "minStake",
  });
}

/**
 * Get the cooldown period in seconds.
 */
export async function getCooldownPeriod(): Promise<bigint> {
  return publicClient.readContract({
    address: getStakeAddress(),
    abi: REPUTATION_STAKE_ABI,
    functionName: "COOLDOWN",
  });
}

/**
 * Get the reputation stake contract config for client-side use.
 */
export function getReputationStakeConfig() {
  return {
    address: REPUTATION_STAKE_ADDRESS ?? null,
    chainId: chain.id,
    chainName: chain.name,
    usdcDecimals: 6,
    minStakeUsdc: 20,
    cooldownDays: 7,
  };
}
