/**
 * x402.ts
 * Mock x402 payment request handler for Coinbase Smart Wallet SDK.
 * Implements the x402 protocol request/response shape.
 * Replace `signAndBroadcast` with real Coinbase SDK call when keys are available.
 */

import { createHash, randomBytes } from "crypto";
import { createTask } from "@/lib/db/tasks";
import { log } from "@/lib/logging";

export interface X402PaymentRequest {
  from_agent_wallet: string;
  to_human_wallet: string;
  task_description: string;
  amount_usdc: number;
  deadline_unix: number;
}

export interface X402PaymentResponse {
  status: "pending" | "confirmed" | "failed";
  tx_hash: string;
  escrow_contract: string;
  payment_request_id: string;
  amount_usdc: number;
  base_network: "mainnet" | "testnet";
  timestamp_unix: number;
}

const BASE_ESCROW_CONTRACT = "0xESCROW_MOCK_CONTRACT_ADDRESS_ON_BASE";
const BASE_NETWORK = (process.env.NEXT_PUBLIC_BASE_NETWORK ?? "testnet") as
  | "mainnet"
  | "testnet";

/**
 * signAndBroadcast
 * MOCK: Simulates signing and broadcasting a Base L2 x402 payment to escrow.
 * Real implementation: use `@coinbase/coinbase-sdk` onchain transactions.
 */
async function signAndBroadcast(req: X402PaymentRequest): Promise<string> {
  const nonce = randomBytes(8).toString("hex");
  const raw = `${req.from_agent_wallet}:${req.to_human_wallet}:${req.amount_usdc}:${nonce}`;
  return "0x" + createHash("sha256").update(raw).digest("hex");
}

/**
 * initiateX402Payment
 * Creates an escrow payment request on Base L2 via x402 protocol.
 * Persists the task to Supabase for tracking.
 */
export async function initiateX402Payment(
  req: X402PaymentRequest,
): Promise<X402PaymentResponse> {
  if (req.amount_usdc <= 0) {
    throw new Error("amount_usdc must be > 0");
  }
  if (!req.from_agent_wallet.startsWith("0x")) {
    throw new Error("from_agent_wallet must be a valid 0x address");
  }
  if (!req.to_human_wallet.startsWith("0x")) {
    throw new Error("to_human_wallet must be a valid 0x address");
  }

  const tx_hash = await signAndBroadcast(req);
  const payment_request_id = randomBytes(16).toString("hex");

  // Persist to database
  await createTask({
    payment_request_id,
    from_agent_wallet: req.from_agent_wallet,
    to_human_wallet: req.to_human_wallet,
    task_description: req.task_description,
    amount_usdc: req.amount_usdc,
    deadline_unix: req.deadline_unix,
    tx_hash,
    escrow_contract: BASE_ESCROW_CONTRACT,
  });

  log("info", "payment_initiated", {
    payment_request_id,
    amount_usdc: req.amount_usdc,
    to_human_wallet: req.to_human_wallet,
  });

  return {
    status: "pending",
    tx_hash,
    escrow_contract: BASE_ESCROW_CONTRACT,
    payment_request_id,
    amount_usdc: req.amount_usdc,
    base_network: BASE_NETWORK,
    timestamp_unix: Math.floor(Date.now() / 1000),
  };
}
