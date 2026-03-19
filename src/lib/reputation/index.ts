/**
 * reputation/index.ts
 * Compositor — combines DB task history, on-chain stake, and computed score.
 */

import { getReputationSummary } from "@/lib/db/tasks";
import { getWorkerStake, getReputationStakeConfig } from "@/lib/contracts/reputation";
import { computeReputation, type ReputationBreakdown } from "./compute";

const USDC_DECIMALS = 6;

export interface FullReputation {
  wallet: string;
  score: number;
  breakdown: ReputationBreakdown;
  tasks: {
    total: number;
    completed: number;
    disputed: number;
    expired: number;
    active: number;
    pending: number;
    total_earned_usdc: number;
    completion_rate: number | null;
  };
  stake: {
    amount_usdc: number;
    staked_at: number;
    slashed_total_usdc: number;
    contract: string | null;
  };
}

export async function getFullReputation(wallet: string): Promise<FullReputation> {
  const summary = await getReputationSummary(wallet);

  // Try on-chain stake — graceful fail if contract not deployed
  let stakeAmountUsdc = 0;
  let stakedAt = 0;
  let slashedTotalUsdc = 0;
  const stakeConfig = getReputationStakeConfig();

  if (stakeConfig.address) {
    try {
      const onChainStake = await getWorkerStake(wallet);
      stakeAmountUsdc =
        Number(onChainStake.amount) / 10 ** USDC_DECIMALS;
      stakedAt = Number(onChainStake.stakedAt);
      slashedTotalUsdc =
        Number(onChainStake.slashedTotal) / 10 ** USDC_DECIMALS;
    } catch {
      // Contract not deployed or wallet has no stake — use defaults
    }
  }

  const breakdown = computeReputation({
    completed: summary.completed,
    disputed: summary.disputed,
    totalTasks: summary.total_tasks,
    stakeAmountUsdc,
    recentCompletions: summary.recentCompletions,
    midCompletions: summary.midCompletions,
  });

  return {
    wallet,
    score: breakdown.total,
    breakdown,
    tasks: {
      total: summary.total_tasks,
      completed: summary.completed,
      disputed: summary.disputed,
      expired: summary.expired,
      active: summary.active,
      pending: summary.pending,
      total_earned_usdc: summary.total_earned_usdc,
      completion_rate:
        summary.total_tasks > 0
          ? Math.round((summary.completed / summary.total_tasks) * 100)
          : null,
    },
    stake: {
      amount_usdc: stakeAmountUsdc,
      staked_at: stakedAt,
      slashed_total_usdc: slashedTotalUsdc,
      contract: stakeConfig.address,
    },
  };
}
