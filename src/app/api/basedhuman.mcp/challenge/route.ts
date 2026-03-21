/**
 * route.ts — /api/basedhuman.mcp/challenge
 *
 * Issues single-use, time-limited nonces for SIWE-style MCP authentication.
 * Agent calls this first, signs the nonce, then includes signature in MCP requests.
 */

import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { getSupabaseAdmin } from "@/lib/db/client";
import { isValidWalletAddress } from "@/lib/validation";
import { log } from "@/lib/logging";

const CHALLENGE_TTL_S = 60; // 60 seconds

export async function POST(req: NextRequest): Promise<Response> {
  let body: { walletAddress?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { walletAddress } = body;
  if (!walletAddress || !isValidWalletAddress(walletAddress)) {
    return Response.json(
      { error: "Valid walletAddress required (0x-prefixed, 40 hex chars)" },
      { status: 400 },
    );
  }

  const nonce = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_S * 1000);

  const supabase = getSupabaseAdmin();

  // Purge expired challenges (best-effort cleanup, same pattern as used_nonces)
  await supabase
    .from("mcp_challenges")
    .delete()
    .lt("expires_at", new Date().toISOString());

  const { error } = await supabase.from("mcp_challenges").insert({
    wallet_address: walletAddress.toLowerCase(),
    nonce,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    log("error", "challenge_create_failed", { error: error.message });
    return Response.json({ error: "Failed to create challenge" }, { status: 500 });
  }

  log("info", "mcp_challenge_issued", { wallet: walletAddress });

  return Response.json({
    nonce,
    expiresAt: Math.floor(expiresAt.getTime() / 1000),
    message: `carbon-contractors.com wants to verify wallet ownership\nNonce: ${nonce}\nTimestamp: ${Math.floor(Date.now() / 1000)}`,
  });
}
