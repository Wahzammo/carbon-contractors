/**
 * args.mjs — CLI argument parsing for the CC-077 funding-stage harness.
 *
 * Pure, unit-tested. funding-stage.mjs (which self-executes) only passes
 * process.argv in and acts on the result.
 *
 * Convention: `--flag=value` only (matching scripts/audit/verify-eas-deployment.mjs
 * and its peers). Bare `--dry-run` / `--execute` are the two boolean flags.
 * Case flags come from cases.mjs — one per run.
 */

import { CASES_BY_FLAG } from "./cases.mjs";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;

export const USAGE = `usage: node --env-file=.env.local scripts/lifecycle/funding-stage.mjs [--dry-run | --execute] [options] [case flag]

mode    --dry-run   validate config, print the exact execution plan, move nothing (default)
        --execute   run the plan for real. Broadcasts transactions from the agent
                    wallet named by AGENT_WALLET_PRIVATE_KEY. Base Sepolia only.

options
        --task-id=<payment_request_id>   resume from an existing offer/accepted row.
                                         Step 1 (request_human_work) is NOT automated —
                                         it needs a running, authenticated MCP session,
                                         so run it yourself and pass the id here.
        --worker=0x…                     worker payout address (from the quote you got)
        --amount-usdc=<n>                quoted amount, whole USDC units
        --deadline-hours=<n>             hours from now for the delivery deadline (1–720)
        --review-window-hours=<n>        12–336 (contract bound)
        --spec-hash=0x…                  the spec_hash from the quote (bytes32)

cases   one flag per run, from CC-077's unhappy-path list:
${Object.values(CASES_BY_FLAG)
  .map((c) => `          ${c.flag.padEnd(34)} ${c.title}`)
  .join("\n")}`;

/**
 * @param {string[]} argv — process.argv.slice(2)
 * @returns {{ dryRun: boolean, execute: boolean, taskId: string|null, worker: string|null,
 *             amountUsdc: number|null, deadlineHours: number|null, reviewWindowHours: number|null,
 *             specHash: string|null, caseKeys: string[], flags: string[] }}
 * @throws {Error} with usage guidance on unknown flags, malformed values, or
 *   contradictory modes. One error may list several problems (same principle as
 *   the config validator: fail once, say everything).
 */
export function parseArgs(argv) {
  const problems = [];
  const parsed = {
    dryRun: false,
    execute: false,
    taskId: null,
    worker: null,
    amountUsdc: null,
    deadlineHours: null,
    reviewWindowHours: null,
    specHash: null,
    caseKeys: [],
    flags: [],
  };

  const numbers = {
    "--amount-usdc": "amountUsdc",
    "--deadline-hours": "deadlineHours",
    "--review-window-hours": "reviewWindowHours",
  };

  for (const arg of argv) {
    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg : arg.slice(0, eq);
    const value = eq === -1 ? null : arg.slice(eq + 1);

    if (name === "--dry-run") {
      parsed.dryRun = true;
      parsed.flags.push(name);
    } else if (name === "--execute") {
      parsed.execute = true;
      parsed.flags.push(name);
    } else if (name === "--task-id") {
      parsed.taskId = requireValue(name, value, problems);
    } else if (name === "--worker") {
      const v = requireValue(name, value, problems);
      if (v !== null) {
        if (!ADDRESS_RE.test(v)) problems.push(`${name}: "${v}" is not a 0x-prefixed 40-hex address`);
        else parsed.worker = v.toLowerCase(); // wallets are lowercase in the DB (migration 014)
      }
    } else if (name === "--spec-hash") {
      const v = requireValue(name, value, problems);
      if (v !== null) {
        if (!BYTES32_RE.test(v)) problems.push(`${name}: "${v}" is not a bytes32 (0x + 64 hex)`);
        else parsed.specHash = v;
      }
    } else if (name in numbers) {
      const field = numbers[name];
      const v = requireValue(name, value, problems);
      if (v !== null) {
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0) problems.push(`${name}: "${v}" is not a positive number`);
        else if (name !== "--amount-usdc" && !Number.isInteger(n))
          problems.push(`${name}: "${v}" must be a whole number of hours`);
        else parsed[field] = n;
      }
    } else if (name in CASES_BY_FLAG) {
      if (eq !== -1) problems.push(`${name} takes no value (got "=${value}")`);
      else {
        const { caseKey } = CASES_BY_FLAG[name];
        if (!parsed.caseKeys.includes(caseKey)) parsed.caseKeys.push(caseKey);
        parsed.flags.push(name);
      }
    } else {
      problems.push(`unknown flag: ${name}`);
    }
  }

  if (parsed.dryRun && parsed.execute) {
    problems.push("--dry-run and --execute are mutually exclusive — pick a mode (default is --dry-run).");
  }

  if (problems.length > 0) {
    throw new Error(["Bad arguments:", "", ...problems.map((p, i) => `${i + 1}. ${p}`), "", USAGE].join("\n"));
  }

  return parsed;
}

function requireValue(name, value, problems) {
  if (value === null || value === "") {
    problems.push(`${name} needs a value: ${name}=<value>`);
    return null;
  }
  return value;
}

/**
 * Fill argument defaults for a run. Deliberately separate from parseArgs: the
 * defaults are plan-level decisions (amounts, windows), not syntax, and the
 * case mutations in cases.mjs apply on top of the result.
 */
export function withDefaults(parsed, defaults) {
  return {
    ...parsed,
    amountUsdc: parsed.amountUsdc ?? defaults.amountUsdc,
    deadlineHours: parsed.deadlineHours ?? defaults.deadlineHours,
    reviewWindowHours: parsed.reviewWindowHours ?? defaults.reviewWindowHours,
  };
}
