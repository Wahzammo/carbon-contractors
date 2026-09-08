import { describe, it, expect } from "vitest";
import { validateLifecycleConfig, loadChainConstants, configFailureMessage } from "../config.mjs";
import { CASES, CASE_FLAG_LIST, selectCase } from "../cases.mjs";
import { parseArgs, withDefaults } from "../args.mjs";
import { buildPlan, deriveTaskIdBytes32 } from "../plan.mjs";
import { readFileSync } from "node:fs";

// CC-060: hermetic. Everything imported here is pure — no client construction,
// no fetch, no env reads outside the objects passed in explicitly. The plan
// builder's keccak256 is computed locally, never asked of a chain.

const CONSTANTS = loadChainConstants(
  readFileSync(new URL("../../../chain-constants.json", import.meta.url), "utf8"),
);

const GOOD_ENV = {
  BASE_SEPOLIA_RPC_URL: "https://dedicated.example/v1",
  AGENT_WALLET_PRIVATE_KEY: "0x" + "a".repeat(64),
  NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
};

// ── config validation ────────────────────────────────────────────────────────

describe("validateLifecycleConfig (CC-077)", () => {
  it("reports EVERY missing item at once, not one at a time", () => {
    const result = validateLifecycleConfig({}, { constants: CONSTANTS });
    expect(result.ok).toBe(false);
    const message = result.problems.join("\n");
    for (const name of ["BASE_SEPOLIA_RPC_URL", "AGENT_WALLET_PRIVATE_KEY", "NEXT_PUBLIC_BASE_URL"]) {
      expect(message, `problem list must name ${name}`).toContain(name);
    }
    expect(result.problems).toHaveLength(3);
  });

  it("treats a blank var as missing, not configured (CC-097)", () => {
    const result = validateLifecycleConfig(
      { ...GOOD_ENV, BASE_SEPOLIA_RPC_URL: "", AGENT_WALLET_PRIVATE_KEY: "" },
      { constants: CONSTANTS },
    );
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toContain("BASE_SEPOLIA_RPC_URL is not set");
    expect(result.problems.join("\n")).toContain("AGENT_WALLET_PRIVATE_KEY is not set");
  });

  it("rejects a malformed private key without ever echoing its value", () => {
    const bad = "0xnotakey";
    const result = validateLifecycleConfig(
      { ...GOOD_ENV, AGENT_WALLET_PRIVATE_KEY: bad },
      { constants: CONSTANTS },
    );
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toContain("malformed");
    expect(result.problems.join("\n")).not.toContain(bad); // format complaint, not a value leak
  });

  it("rejects an env pointed at mainnet — the harness is pinned to base-sepolia", () => {
    const result = validateLifecycleConfig(
      { ...GOOD_ENV, NEXT_PUBLIC_BASE_NETWORK: "mainnet" },
      { constants: CONSTANTS },
    );
    expect(result.ok).toBe(false);
    expect(result.problems.join("\n")).toContain("base-sepolia");
  });

  it("accepts a good env and returns addresses ONLY from the passed constants", () => {
    const result = validateLifecycleConfig(GOOD_ENV, { constants: CONSTANTS });
    expect(result.ok).toBe(true);
    expect(result.config).toMatchObject({
      escrow: CONSTANTS.escrow,
      usdc: CONSTANTS.usdc,
      chainId: CONSTANTS.chainId,
      deployBlock: CONSTANTS.deployBlock,
      reviewWindowSeconds: CONSTANTS.reviewWindowSeconds,
    });
    // The private key must never ride along in the resolved config.
    expect(JSON.stringify(result.config)).not.toContain("aaaa");
  });

  it("strips a trailing slash from the base URL so path joins cannot double up", () => {
    const result = validateLifecycleConfig(
      { ...GOOD_ENV, NEXT_PUBLIC_BASE_URL: "http://localhost:3000/" },
      { constants: CONSTANTS },
    );
    expect(result.config.baseUrl).toBe("http://localhost:3000");
  });

  it("refuses to guess if chain-constants has no base-sepolia deployment", () => {
    const gutted = JSON.parse(JSON.stringify(CONSTANTS));
    gutted.escrow = { address: null };
    expect(() => loadChainConstants(JSON.stringify(gutted))).toThrow(/refuses to guess/);
  });

  it("configFailureMessage numbers every problem and points at the README", () => {
    const msg = configFailureMessage(["one", "two"]);
    expect(msg).toContain("1. one");
    expect(msg).toContain("2. two");
    expect(msg).toContain("scripts/lifecycle/README.md");
  });
});

// ── case registry ────────────────────────────────────────────────────────────

describe("case registry (CC-077 unhappy paths)", () => {
  it("has exactly one CLI flag per unhappy path in CC-077's rescoped list", () => {
    expect(CASE_FLAG_LIST).toEqual([
      "--case-task-already-exists",
      "--case-zero-amount",
      "--case-invalid-worker",
      "--case-deadline-passed",
      "--case-invalid-review-window",
      "--case-insufficient-allowance",
      "--case-insufficient-balance",
      "--case-fund-task-before-funding",
      "--case-worker-amount-mismatch",
    ]);
  });

  it("every case asserts a clean outcome and names the contract revert it expects", () => {
    for (const c of Object.values(CASES)) {
      expect(c.assertClean, `${c.flag ?? "happy"} must state its clean outcome`).toBeTruthy();
    }
    for (const [name, revert] of Object.entries({
      taskAlreadyExists: "TaskAlreadyExists",
      zeroAmount: "ZeroAmount",
      invalidWorker: "InvalidWorker",
      deadlinePassed: "DeadlinePassed",
      invalidReviewWindow: "InvalidReviewWindow",
    })) {
      expect(CASES[name].assertClean).toContain(revert);
    }
  });

  it("guard cases never broadcast — simulated via eth_call only", () => {
    for (const key of ["taskAlreadyExists", "zeroAmount", "invalidWorker", "deadlinePassed", "invalidReviewWindow", "insufficientBalance"]) {
      expect(CASES[key].simulateOnly, `${key} must be simulateOnly`).toBe(true);
    }
    // The two cases whose whole subject is real funding DO broadcast.
    expect(CASES.insufficientAllowance.simulateOnly).toBe(false);
    expect(CASES.workerAmountMismatch.simulateOnly).toBe(false);
  });

  it("selectCase defaults to happy and refuses two cases in one run", () => {
    expect(selectCase([]).caseKey).toBe("happy");
    expect(() => selectCase(["zeroAmount", "deadlinePassed"])).toThrow(/one case flag per run/i);
  });

  it("worker-amount-mismatch states its recovery path — no silent stranding", () => {
    expect(CASES.workerAmountMismatch.assertClean).toContain("expireTask");
  });
});

// ── argument parsing ─────────────────────────────────────────────────────────

describe("parseArgs (CC-077)", () => {
  it("defaults to dry-run mode", () => {
    const parsed = parseArgs([]);
    expect(parsed.dryRun).toBe(false); // dry-run is the DEFAULT, expressed as neither flag
    expect(parsed.execute).toBe(false);
    expect(parsed.caseKeys).toEqual([]);
  });

  it("parses values, case flags and modes", () => {
    const parsed = parseArgs([
      "--execute",
      "--task-id=cc077-001",
      "--worker=0xAbCdEf0123456789012345678901234567890123",
      "--amount-usdc=1.5",
      "--case-zero-amount",
    ]);
    expect(parsed.execute).toBe(true);
    expect(parsed.taskId).toBe("cc077-001");
    expect(parsed.worker).toBe("0xabcdef0123456789012345678901234567890123"); // lowercased, migration 014
    expect(parsed.amountUsdc).toBe(1.5);
    expect(parsed.caseKeys).toEqual(["zeroAmount"]);
  });

  it("collects every argument problem in one error, not one at a time", () => {
    let message = "";
    try {
      parseArgs(["--worker=nope", "--review-window-hours=1.5", "--nonsense", "--dry-run", "--execute"]);
    } catch (error) {
      message = String(error?.message ?? error);
    }
    // Order is not part of the contract; the presence of ALL problems (numbered,
    // in one message) is. Failing one-at-a-time would mean four runs to learn
    // what one run could have said.
    expect(message).toContain("--worker");
    expect(message).toContain("--review-window-hours");
    expect(message).toContain("unknown flag: --nonsense");
    expect(message).toContain("mutually exclusive");
    expect(message.match(/^\d+\./gm)?.length).toBeGreaterThanOrEqual(4);
  });

  it("rejects malformed values", () => {
    expect(() => parseArgs(["--worker=0x123"])).toThrow(/not a 0x-prefixed 40-hex address/);
    expect(() => parseArgs(["--spec-hash=0x123"])).toThrow(/bytes32/);
    expect(() => parseArgs(["--amount-usdc=0"])).toThrow(/positive number/);
    expect(() => parseArgs(["--task-id"])).toThrow(/needs a value/);
  });

  it("does not double-count a repeated case flag as two cases", () => {
    expect(parseArgs(["--case-zero-amount", "--case-zero-amount"]).caseKeys).toEqual(["zeroAmount"]);
  });

  it("withDefaults fills the testnet-cheap defaults", () => {
    const filled = withDefaults(parseArgs([]), { amountUsdc: 1, deadlineHours: 48, reviewWindowHours: 24 });
    expect(filled).toMatchObject({ amountUsdc: 1, deadlineHours: 48, reviewWindowHours: 24 });
  });
});

// ── plan building ────────────────────────────────────────────────────────────

describe("buildPlan (CC-077)", () => {
  const parsed = withDefaults(
    parseArgs(["--task-id=cc077-001", "--worker=0xabcdef0123456789012345678901234567890123", "--spec-hash=0x" + "b".repeat(64)]),
    { amountUsdc: 1, deadlineHours: 48, reviewWindowHours: 24 },
  );
  const NOW = 1_700_000_000;

  it("derives the on-chain taskId locally, exactly as the app does", async () => {
    // Independent derivation of keccak256(toHex("cc077-001")) — a change in the
    // derivation would desync the harness from every taskId ever funded.
    const { keccak256, toHex } = await import("viem");
    expect(deriveTaskIdBytes32("cc077-001")).toBe(keccak256(toHex("cc077-001")));
  });

  it("happy path quotes amount/deadline/reviewWindow consistent with the args", () => {
    const plan = buildPlan({ parsed, config: fakeConfig(), caseKey: "happy", now: NOW });
    expect(plan.inputs.amount_wei).toBe("1000000"); // 1 USDC, 6 decimals
    expect(plan.inputs.deadline_unix).toBe(NOW + 48 * 3600);
    expect(plan.inputs.review_window_seconds).toBe(24 * 3600);
    expect(plan.inputs.fund_url).toContain("/api/fund-task");
  });

  it("computes the deliberate-invalid arguments for the guard cases", () => {
    const past = buildPlan({ parsed, config: fakeConfig(), caseKey: "deadlinePassed", now: NOW });
    expect(Number(past.inputs.deadline_unix)).toBeLessThan(NOW); // in the past

    const window = buildPlan({ parsed, config: fakeConfig(), caseKey: "invalidReviewWindow", now: NOW });
    expect(Number(window.inputs.review_window_seconds)).toBe(CONSTANTS.reviewWindowSeconds.min - 1);

    const zero = buildPlan({ parsed, config: fakeConfig(), caseKey: "zeroAmount", now: NOW });
    expect(zero.inputs.amount_wei).toBe("0");

    const zeroWorker = buildPlan({ parsed, config: fakeConfig(), caseKey: "invalidWorker", now: NOW });
    expect(zeroWorker.inputs.worker).toBe("0x0000000000000000000000000000000000000000");
  });

  it("mismatch case funds one unit more than the row is quoted, and says so", () => {
    const plan = buildPlan({ parsed, config: fakeConfig(), caseKey: "workerAmountMismatch", now: NOW });
    expect(plan.inputs.funded_wei).toBe("1000001");
    expect(plan.inputs.amount_wei).toBe("1000000");
    expect(plan.steps.some((s) => /expireTask/.test(s.action))).toBe(true);
  });

  it("allowance case approves one unit short of the amount", () => {
    const plan = buildPlan({ parsed, config: fakeConfig(), caseKey: "insufficientAllowance", now: NOW });
    expect(plan.inputs.approve_wei).toBe("999999");
    expect(plan.inputs.amount_wei).toBe("1000000");
  });

  it("every plan — happy, guards, fund-flow — ends with the solvency check", () => {
    for (const caseKey of Object.keys(CASES)) {
      const plan = buildPlan({ parsed, config: fakeConfig(), caseKey, now: NOW });
      const last = plan.steps.at(-1);
      expect(last.title, `${caseKey} must end with solvency`).toMatch(/Solvency reconciliation/);
      expect(last.action).toContain("verify-escrow-solvency.mjs");
    }
  });
});

function fakeConfig() {
  // Shape-compatible with validateLifecycleConfig's success result; the plan
  // builder must not care where the constants came from.
  return {
    rpcUrl: "https://dedicated.example/v1",
    baseUrl: "http://localhost:3000",
    escrow: CONSTANTS.escrow,
    usdc: CONSTANTS.usdc,
    usdcDecimals: CONSTANTS.usdcDecimals,
    chainId: CONSTANTS.chainId,
    deployBlock: CONSTANTS.deployBlock,
    reviewWindowSeconds: CONSTANTS.reviewWindowSeconds,
  };
}
