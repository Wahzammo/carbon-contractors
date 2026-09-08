/**
 * plan.mjs — build and render the execution plan for a harness run.
 *
 * Pure. The same buildPlan output is rendered verbatim by --dry-run ("the
 * exact execution plan") and executed step-by-step by --execute, so the plan
 * cannot drift from what runs.
 *
 * `now` (unix seconds) is injected rather than read from Date.now(), so the
 * computed-argument cases (deadline in the past, review window below the
 * minimum) are deterministic under test.
 */

import { keccak256, toHex } from "viem";
import { CASES } from "./cases.mjs";

const USDC_DECIMALS = 6;

/** keccak256(payment_request_id) — the on-chain taskId. Same derivation as
 *  src/lib/contracts/escrow.ts toTaskId; computed locally, never asked of a
 *  server (CC-077 edge case: payment_request_id is not public for unfunded
 *  rows, so it must come from the request_human_work response, not /api/tasks). */
export function deriveTaskIdBytes32(paymentRequestId) {
  return keccak256(toHex(paymentRequestId));
}

function toWei(amountUsdc) {
  return BigInt(Math.round(amountUsdc * 10 ** USDC_DECIMALS));
}

/**
 * @param {{ parsed: object, config: object, caseKey: string, now: number }} input
 * @returns {{ caseKey: string, title: string, assertClean: string, steps: object[],
 *             inputs: object, taskIdBytes32: string|null }}
 */
export function buildPlan({ parsed, config, caseKey, now }) {
  const caseDef = CASES[caseKey];
  const m = caseDef.mutations ?? {};

  const amountUsdc = m.amountUsdc ?? parsed.amountUsdc;
  const amountWei = toWei(amountUsdc);
  // Cases that deliberately misfund: what the chain will actually receive.
  const fundedWei =
    m.amountOffByUnits !== undefined
      ? amountWei + BigInt(m.amountOffByUnits)
      : m.amountAboveBalanceByUnits !== undefined
        ? amountWei + BigInt(m.amountAboveBalanceByUnits) // plan prints the +1; the live runner reads the balance and tops it
        : amountWei;
  const approveWei =
    m.approveShortByUnits !== undefined ? amountWei - BigInt(m.approveShortByUnits) : fundedWei;
  const deadlineUnix = m.deadlineUnix === null ? now - 3600 : now + parsed.deadlineHours * 3600;
  const reviewWindowSeconds =
    m.reviewWindowSeconds === null
      ? config.reviewWindowSeconds.min - 1
      : parsed.reviewWindowHours * 3600;

  const taskIdBytes32 = parsed.taskId ? deriveTaskIdBytes32(parsed.taskId) : null;

  const inputs = {
    payment_request_id: parsed.taskId,
    task_id_bytes32: taskIdBytes32,
    worker: m.worker ?? parsed.worker,
    amount_usdc: amountUsdc,
    amount_wei: String(amountWei),
    approve_wei: String(approveWei),
    funded_wei: String(fundedWei),
    deadline_unix: deadlineUnix,
    review_window_seconds: reviewWindowSeconds,
    spec_hash: parsed.specHash,
    escrow_contract: config.escrow,
    usdc_contract: config.usdc,
    chain_id: config.chainId,
    fund_url: parsed.taskId ? `${config.baseUrl}/api/fund-task` : null,
  };

  const steps = [];

  if (caseKey === "happy") {
    steps.push(step(1, "Offer row exists (request_human_work)",
      parsed.taskId
        ? `RESUMING from --task-id ${parsed.taskId}. Step 1 is manual: request_human_work needs a running, authenticated MCP session. Verify the row via GET ${config.baseUrl}/api/tasks and confirm status is 'accepted' (or 'pending' with the worker accepting via POST /api/offers/accept) BEFORE any money moves — /api/fund-task refuses anything else (ADR-0005 D2).`
        : "MISSING --task-id: run request_human_work yourself (MCP session required) and re-invoke with --task-id=<payment_request_id>. Not automated — see README, 'What is NOT automated'.",
      "row status via GET /api/tasks", "'accepted' (worker consent) before funding; never 'pending'"));
    steps.push(step(2, "Derive taskId", `keccak256(toHex("${parsed.taskId ?? "<payment_request_id>"}")) = ${taskIdBytes32 ?? "<computed once --task-id is supplied>"}`,
      "task_id_bytes32", "matches the quote's task_id_bytes32"));
    steps.push(step(3, "USDC.approve", `approve(escrow ${config.escrow}, ${inputs.approve_wei} units${approveWei !== fundedWei ? " — DELIBERATELY short" : ""}) from the agent wallet`,
      "tx hash", "receipt status 1"));
    steps.push(step(4, "escrow.createTask", `createTask(${taskIdBytes32 ?? "<task_id_bytes32>"}, ${inputs.worker ?? "<worker>"}, ${inputs.funded_wei}, ${deadlineUnix}, ${reviewWindowSeconds}, ${inputs.spec_hash ?? "<spec_hash>"})`,
      "tx hash + getTask(taskId) readback", "on-chain state Funded; task.agent = agent wallet; task.worker and task.amount match the quote"));
    steps.push(step(5, "Confirm via POST /api/fund-task", `POST ${config.baseUrl}/api/fund-task {"payment_request_id": "${parsed.taskId ?? "<id>"}"}`,
      "HTTP status + JSON body", "200, ok:true, status:'active', on_chain_state:'Funded'"));
    steps.push(step(6, "Worker notified (step 5 of the flow)", "MANUAL CHECK — the harness cannot verify delivery through the worker's channel. See README, 'What is NOT automated'.",
      "human confirmation", "worker acknowledges the notification"));
  } else if (caseDef.kind === "guard") {
    steps.push(step(1, "Simulate createTask via eth_call (no broadcast)", caseDef.simulateOnly && caseDef.requiresTaskId
        ? `createTask against already-funded ${taskIdBytes32 ?? "<task_id_bytes32 of a FUNDED task — required>"} — eth_call from the agent wallet. ${caseDef.precondition}`
        : `createTask(${taskIdBytes32 ?? "<derived-or-arbitrary task_id_bytes32>"}, ${inputs.worker ?? "<worker>"}, ${inputs.amount_wei}, ${deadlineUnix}, ${reviewWindowSeconds}, ${inputs.spec_hash ?? "<spec_hash>"}) — eth_call from the agent wallet.`,
      "revert data from eth_call", `reverts ${expectedRevert(caseKey)}`));
    steps.push(step(2, "Nothing moved", "No transaction broadcast (guards run before safeTransferFrom), nothing to clean up.",
      "absence of tx hashes", "no USDC left the wallet; no row changed"));
  } else {
    // fund-flow and route cases
    if (caseKey === "fundTaskBeforeFunding") {
      steps.push(step(1, "Verify the row is 'accepted' and unfunded", `GET ${config.baseUrl}/api/tasks — find ${parsed.taskId ?? "<payment_request_id>"} (payment_request_id is null for unfunded rows in the public feed, so match on the id you hold).`,
        "row status", "'accepted'"));
      steps.push(step(2, "POST /api/fund-task with NO on-chain task", `POST ${config.baseUrl}/api/fund-task {"payment_request_id": "${parsed.taskId ?? "<id>"}"}`,
        "HTTP status + JSON body", "409, on_chain_state:\"None\", error naming the missing funding"));
      steps.push(step(3, "Row untouched", `GET ${config.baseUrl}/api/tasks re-read`,
        "row status", "still 'accepted' — NOT 'active', NOT 'pending'"));
    } else {
      steps.push(step(1, "Fund deliberately wrong", caseKey === "workerAmountMismatch"
          ? `approve(${config.escrow}, ${inputs.funded_wei}) then createTask(${taskIdBytes32}, ${inputs.worker}, ${inputs.funded_wei}, …) — 1 unit MORE than the row's quoted ${inputs.amount_wei}. REAL USDC locks on-chain; recovery is below.`
          : `approve(${config.escrow}, ${inputs.approve_wei} — deliberately 1 unit short) then createTask for ${inputs.amount_wei} units.`,
        "tx hash(es) / revert reason",
        caseKey === "workerAmountMismatch" ? "createTask succeeds on-chain (it has no idea what the DB quoted)" : "createTask reverts ERC20InsufficientAllowance; no on-chain task exists"));
      steps.push(step(2, "Attempt confirmation", `POST ${config.baseUrl}/api/fund-task {"payment_request_id": "${parsed.taskId ?? "<id>"}"}`,
        "HTTP status + JSON body", "409 — refusal (mismatch, or on_chain_state None for the allowance case)"));
      steps.push(step(3, "Row untouched + recovery", caseKey === "workerAmountMismatch"
          ? `GET ${config.baseUrl}/api/tasks: row still 'accepted', NOT 'active'. RECOVERY (mandatory): the on-chain task holds ${inputs.funded_wei} units — the agent wallet reclaims it with agent-only escrow.expireTask (pull refund, ADR-0001 A1.2). Nothing else can move it; CarbonEscrow has no rescue.`
          : "GET /api/tasks: row still 'accepted'. Nothing locked on-chain — the transfer itself failed — so there is nothing to recover.",
        "row status", "'accepted' — the DB never activated a task the chain does not vouch for"));
    }
  }

  steps.push(finalCheck(config));

  return {
    caseKey,
    title: caseDef.title,
    assertClean: caseDef.assertClean,
    steps,
    inputs,
    taskIdBytes32,
  };
}

function expectedRevert(caseKey) {
  return {
    taskAlreadyExists: "TaskAlreadyExists",
    zeroAmount: "ZeroAmount",
    invalidWorker: "InvalidWorker",
    deadlinePassed: "DeadlinePassed",
    invalidReviewWindow: "InvalidReviewWindow",
    insufficientBalance: "ERC20InsufficientBalance",
  }[caseKey];
}

function step(n, title, action, evidence, expect) {
  return { n, title, action, evidence, expect };
}

function finalCheck(config) {
  return step(99, "Solvency reconciliation (end of EVERY run)", `spawn: node --env-file=.env.local scripts/audit/verify-escrow-solvency.mjs (escrow ${config.escrow})`,
    "exit code + verdict line", "CLEAN — balance equals totalLocked (no USDC stranded by this run)");
}

/** Render the plan in the audit-script house style. */
export function renderPlan(plan, mode) {
  const lines = [];
  lines.push(`── CC-077 funding-stage harness ─────────────────────────────────`);
  lines.push(`mode      ${mode}`);
  lines.push(`case      ${plan.caseKey} — ${plan.title}`);
  lines.push("");
  lines.push("inputs");
  for (const [k, v] of Object.entries(plan.inputs)) lines.push(`  ${k.padEnd(24)} ${v ?? "<not supplied>"}`);
  lines.push("");
  lines.push("plan");
  for (const s of plan.steps) {
    lines.push(`  ${s.n === 99 ? "last" : `${s.n}.`} ${s.title}`);
    lines.push(`     action   ${s.action}`);
    lines.push(`     evidence ${s.evidence}`);
    lines.push(`     expect   ${s.expect}`);
  }
  lines.push("");
  lines.push(`ASSERT CLEAN OUTCOME: ${plan.assertClean}`);
  return lines.join("\n");
}
