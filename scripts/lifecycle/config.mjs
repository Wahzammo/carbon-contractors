/**
 * config.mjs — env + constants validation for the CC-077 funding-stage harness.
 *
 * Pure module, no side effects, no network — unit-tested from
 * scripts/lifecycle/__tests__/funding-stage.test.mjs. The CLI entry
 * (funding-stage.mjs) self-executes on import, so everything testable lives here
 * instead (same precedent as scripts/audit/verdict-line.mjs vs run-monitors.mjs).
 *
 * Design rules this exists to enforce:
 *
 *  - Fail once, listing EVERY missing item. A harness that walks an operator
 *    through config one missing var at a time has already wasted an evening.
 *  - Blank is not unset (CC-097): `VAR=` arrives as "" and must read as missing,
 *    not as configured.
 *  - Escrow, USDC, chain id and deploy block come from chain-constants.json
 *    (networks.base-sepolia) — never from env, never re-derived, never
 *    hard-coded here. That file is a record of a verified deployment; a second
 *    copy in a script is how addresses drift.
 *  - The agent key is NEVER returned, logged, or printed. Validation checks the
 *    name's presence and format only; the value stays in process.env and is read
 *    solely by the --execute runner at the moment of use.
 *
 * The agent wallet env var is AGENT_WALLET_PRIVATE_KEY — a NEW name, on purpose.
 * DEPLOYER_PRIVATE_KEY already exists but is the platform/deployer key, and in
 * this flow the platform must transact nowhere (CC-081 Defect 1: createTask
 * records msg.sender as the agent, so the funder IS the agent). Reusing the
 * deployer var would silently make the platform wallet the on-chain agent —
 * exactly the conflation this harness exists to disprove. See README.md.
 */

import { readFileSync } from "node:fs";

/** Env var names — documented in scripts/lifecycle/README.md and .env.example. */
export const ENV_NAMES = {
  rpcUrl: "BASE_SEPOLIA_RPC_URL",
  agentKey: "AGENT_WALLET_PRIVATE_KEY",
  baseUrl: "NEXT_PUBLIC_BASE_URL",
  network: "NEXT_PUBLIC_BASE_NETWORK",
};

const PRIVATE_KEY_RE = /^0x[0-9a-fA-F]{64}$/;
const HTTP_URL_RE = /^https?:\/\//i;

/**
 * Read chain-constants.json without importing it — vitest and node both resolve
 * JSON import attributes fine today, but fs keeps this module shape-identical
 * under every runner and avoids a second thing to remember.
 *
 * @returns {{ escrow: string, usdc: string, chainId: number, deployBlock: number,
 *             usdcDecimals: number, reviewWindowSeconds: { min: number, max: number } }}
 * @throws if the constants file is missing the base-sepolia deployment — which
 *         would mean a redeploy is mid-flight or the file is wrong, and either
 *         way the harness must not guess.
 */
export function loadChainConstants(constantsJson) {
  const parsed = JSON.parse(constantsJson);
  const net = parsed?.networks?.["base-sepolia"];
  if (!net?.escrow?.address || !net?.usdc?.address) {
    throw new Error(
      "chain-constants.json has no base-sepolia escrow/USDC deployment recorded. " +
        "The harness refuses to guess addresses — re-derive with " +
        "scripts/audit/verify-escrow-deployment.mjs and update the constants file first.",
    );
  }
  return {
    escrow: net.escrow.address,
    deployBlock: net.escrow.deployBlock,
    usdc: net.usdc.address,
    usdcDecimals: net.usdc.decimals,
    chainId: net.chainId,
    reviewWindowSeconds: parsed.protocol.reviewWindowSeconds,
  };
}

function readConstants() {
  // <repo>/scripts/lifecycle/config.mjs → <repo>/chain-constants.json
  return loadChainConstants(
    readFileSync(new URL("../../chain-constants.json", import.meta.url), "utf8"),
  );
}

/**
 * Validate every input the harness needs. Collects ALL problems before
 * reporting — one shot, not a scavenger hunt.
 *
 * @param {Record<string, string|undefined>} env — usually process.env; passed in
 *   so tests can drive it without touching (or trusting) the real environment.
 * @param {{ constants?: ReturnType<typeof loadChainConstants> }} [opts]
 * @returns {{ ok: boolean, problems: string[], config: object|null }}
 *   `problems` are operator-readable sentences, one per defect, all listed at
 *   once. `config` is null when !ok; on success it carries everything except
 *   the private key.
 */
export function validateLifecycleConfig(env, opts = {}) {
  const problems = [];
  const constants = opts.constants ?? readConstants();

  const rpcUrl = env[ENV_NAMES.rpcUrl]?.trim();
  if (!rpcUrl) {
    problems.push(
      `${ENV_NAMES.rpcUrl} is not set. A DEDICATED endpoint, not the public gateway — see CC-048; the public endpoint's rate limit is what makes live runs flaky.`,
    );
  } else if (!HTTP_URL_RE.test(rpcUrl)) {
    problems.push(`${ENV_NAMES.rpcUrl} is not an http(s) URL: got "${rpcUrl}"`);
  }

  // Presence and FORMAT only. The value is deliberately not captured.
  const agentKey = env[ENV_NAMES.agentKey]?.trim();
  if (!agentKey) {
    problems.push(
      `${ENV_NAMES.agentKey} is not set. A TESTNET-ONLY agent wallet key (0x + 64 hex). It must NOT be DEPLOYER_PRIVATE_KEY — the platform must transact nowhere in this flow (CC-081 Defect 1). See scripts/lifecycle/README.md.`,
    );
  } else if (!PRIVATE_KEY_RE.test(agentKey)) {
    problems.push(
      `${ENV_NAMES.agentKey} is malformed — expected 0x followed by 64 hex characters. The value is never printed; only its shape is checked.`,
    );
  }

  const baseUrl = env[ENV_NAMES.baseUrl]?.trim();
  if (!baseUrl) {
    problems.push(
      `${ENV_NAMES.baseUrl} is not set. The harness POSTs /api/fund-task and reads /api/tasks against it (a dev server or the deployment — /api/* is public).`,
    );
  } else if (!HTTP_URL_RE.test(baseUrl)) {
    problems.push(`${ENV_NAMES.baseUrl} is not an http(s) URL: got "${baseUrl}"`);
  }

  // chain-constants pins this harness to base-sepolia; a mainnet-flavoured
  // environment would still read sepolia constants below and quietly aim a
  // funded wallet at the wrong chain's addresses.
  const network = env[ENV_NAMES.network]?.trim();
  if (network && network !== "testnet") {
    problems.push(
      `${ENV_NAMES.network} is "${network}" but this harness is pinned to base-sepolia (chain-constants.json). CC-077 proves the flow on Sepolia; mainnet is CC-034 and is not even deployed.`,
    );
  }

  if (problems.length > 0) return { ok: false, problems, config: null };

  return {
    ok: true,
    problems: [],
    config: {
      rpcUrl,
      baseUrl: baseUrl.replace(/\/+$/, ""), // trailing slash would double up in path joins
      agentKeyEnvName: ENV_NAMES.agentKey,
      escrow: constants.escrow,
      usdc: constants.usdc,
      usdcDecimals: constants.usdcDecimals,
      chainId: constants.chainId,
      deployBlock: constants.deployBlock,
      reviewWindowSeconds: constants.reviewWindowSeconds,
    },
  };
}

/**
 * The operator-facing failure message — every problem, numbered, plus the
 * pointer to the README. Kept as a function so tests can assert on the shape
 * without duplicating the wording.
 */
export function configFailureMessage(problems) {
  const lines = [
    "MISCONFIGURED — the funding-stage harness cannot run. All problems:",
    "",
    ...problems.map((p, i) => `${i + 1}. ${p}`),
    "",
    "See scripts/lifecycle/README.md (Prerequisites).",
  ];
  return lines.join("\n");
}
