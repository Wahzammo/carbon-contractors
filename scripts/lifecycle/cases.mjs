/**
 * cases.mjs — the CC-077 unhappy-path case registry.
 *
 * Pure data + pure helpers, no side effects. One CLI flag per case, exactly as
 * the CC-077 rescope (2026-08-28) lists them. The happy path is the default
 * (no case flag).
 *
 * Two case shapes, deliberately distinct:
 *
 *  - guard cases (contract revert guards): asserted by SIMULATION (eth_call),
 *    never by broadcast. Every guard in CarbonEscrow.createTask runs BEFORE
 *    usdc.safeTransferFrom (contracts/CarbonEscrow.sol createTask), so an
 *    eth_call reverts with the identical custom error and costs no gas, moves
 *    no USDC, and touches no DB row. Broadcasting a deliberate revert would
 *    prove the same thing and pay for the privilege.
 *
 *  - fund-flow cases (real funding, then a refused confirmation): these DO
 *    broadcast in a live run, because the behaviour under test is what the
 *    chain + app do around real money. Each one states its recovery path —
 *    a case whose "clean outcome" strands USDC in a contract with no rescue
 *    function (CC-081 Defect 1) is not clean.
 *
 * `requiresTaskId`: cases that need an existing DB row (and, for
 * task-already-exists, an existing on-chain task) — supplied via --task-id.
 */

/** The contract's revert guards, mirrored by name only — the harness never
 *  hard-codes state integers or re-implements logic, it asserts error names
 *  that contracts/CarbonEscrow.sol defines. */
export const CREATE_TASK_GUARDS = {
  alreadyExists: "TaskAlreadyExists",
  zeroAmount: "ZeroAmount",
  invalidWorker: "InvalidWorker",
  deadlinePassed: "DeadlinePassed",
  invalidReviewWindow: "InvalidReviewWindow",
};

/**
 * Parameter mutations each case applies on top of the CLI args. Keys mirror
 * the plan-step inputs; values are literal. `null` means "computed at plan
 * time" (e.g. deadline in the past = now - 1h).
 */
export const CASES = {
  happy: {
    flag: null,
    title: "Happy path — steps 1–5 of the rescoped flow",
    summary:
      "request_human_work row → USDC.approve + escrow.createTask from the agent wallet → POST /api/fund-task → row 'active' → worker notified.",
    kind: "happy",
    simulateOnly: false,
    requiresTaskId: true,
    assertClean:
      "Row reaches 'active' ONLY via /api/fund-task reading Funded from the chain; on-chain task.agent is the agent wallet, task.worker and task.amount match the quote; verify-escrow-solvency reconciles afterwards.",
  },
  taskAlreadyExists: {
    flag: "--case-task-already-exists",
    title: "Funding an already-used taskId reverts TaskAlreadyExists",
    summary:
      "createTask against a taskId that is already on-chain in state Funded or later.",
    kind: "guard",
    simulateOnly: true,
    requiresTaskId: true,
    requiresFundedTask: true,
    precondition:
      "--task-id must name a task that is ALREADY funded on-chain (run the happy path first, or reuse any funded task's payment_request_id).",
    assertClean:
      "eth_call reverts TaskAlreadyExists; nothing broadcast, totalLocked unchanged, DB row untouched.",
  },
  zeroAmount: {
    flag: "--case-zero-amount",
    title: "Zero amount reverts ZeroAmount",
    summary: "createTask with amount 0.",
    kind: "guard",
    simulateOnly: true,
    requiresTaskId: false,
    mutations: { amountUsdc: 0 },
    assertClean:
      "eth_call reverts ZeroAmount before safeTransferFrom; no approval needed, nothing broadcast, DB row untouched.",
  },
  invalidWorker: {
    flag: "--case-invalid-worker",
    title: "address(0) worker reverts InvalidWorker",
    summary: "createTask with worker 0x0000000000000000000000000000000000000000.",
    kind: "guard",
    simulateOnly: true,
    requiresTaskId: false,
    mutations: { worker: "0x0000000000000000000000000000000000000000" },
    assertClean:
      "eth_call reverts InvalidWorker; nothing broadcast, DB row untouched.",
  },
  deadlinePassed: {
    flag: "--case-deadline-passed",
    title: "A deadline in the past reverts DeadlinePassed",
    summary: "createTask with deadline_unix = now − 3600.",
    kind: "guard",
    simulateOnly: true,
    requiresTaskId: false,
    mutations: { deadlineUnix: null }, // null → computed at plan time (now − 1h)
    assertClean:
      "eth_call reverts DeadlinePassed; nothing broadcast, DB row untouched.",
  },
  invalidReviewWindow: {
    flag: "--case-invalid-review-window",
    title: "reviewWindow outside 12h–14d reverts InvalidReviewWindow",
    summary: "createTask with review_window_seconds = MIN − 1 (11h59m59s).",
    kind: "guard",
    simulateOnly: true,
    requiresTaskId: false,
    mutations: { reviewWindowSeconds: null }, // null → computed at plan time (min − 1)
    assertClean:
      "eth_call reverts InvalidReviewWindow; nothing broadcast, DB row untouched.",
  },
  insufficientAllowance: {
    flag: "--case-insufficient-allowance",
    title: "Allowance below the quoted amount fails cleanly",
    summary:
      "USDC.approve for amount − 1 unit, then createTask — safeTransferFrom reverts ERC20InsufficientAllowance.",
    kind: "fund-flow",
    simulateOnly: false,
    requiresTaskId: true,
    mutations: { approveShortByUnits: 1 },
    assertClean:
      "createTask REVERTS (nothing locked on-chain — the guard order means the transfer itself fails), the DB row stays 'accepted', and POST /api/fund-task still answers 409 on_chain_state None. Clean = nothing moved anywhere.",
  },
  insufficientBalance: {
    flag: "--case-insufficient-balance",
    title: "Balance below the quoted amount fails cleanly",
    summary:
      "Quote an amount larger than the agent wallet's USDC balance, approve it in full, createTask reverts ERC20InsufficientBalance.",
    kind: "fund-flow",
    simulateOnly: true, // approve would waste gas to prove a transfer that cannot clear; simulate
    requiresTaskId: false,
    mutations: { amountAboveBalanceByUnits: 1 },
    assertClean:
      "eth_call reverts ERC20InsufficientBalance; no on-chain task is created, nothing broadcast, DB untouched (no row exists for this quote).",
  },
  fundTaskBeforeFunding: {
    flag: "--case-fund-task-before-funding",
    title: "POST /api/fund-task before any funding returns 409 and leaves the row alone",
    summary:
      "An 'accepted' row with no on-chain task; POST /api/fund-task immediately.",
    kind: "route",
    simulateOnly: false,
    requiresTaskId: true,
    assertClean:
      "HTTP 409 with on_chain_state \"None\" and an error naming the missing funding; the row re-reads 'accepted' (via GET /api/tasks). No chain interaction at all.",
  },
  workerAmountMismatch: {
    flag: "--case-worker-amount-mismatch",
    title: "Funding with a different amount than quoted → 409, row does NOT activate",
    summary:
      "Fund the chain with quoted amount + 1 unit, then POST /api/fund-task for the row quoted at the original amount.",
    kind: "fund-flow",
    simulateOnly: false,
    requiresTaskId: true,
    mutations: { amountOffByUnits: 1 },
    assertClean:
      "HTTP 409 'On-chain task does not match this task row'; the row re-reads 'accepted', NOT 'active'. RECOVERY: the on-chain task is real and holds real USDC — the agent reclaims it with agent-only escrow.expireTask (pull refund, ADR-0001 A1.2). Nothing is stranded provided that step is run; the run prints the reminder.",
  },
};

/** flag string → case def (with its caseKey attached). The inverse map the arg
 *  parser tests against. */
export const CASES_BY_FLAG = Object.fromEntries(
  Object.entries(CASES)
    .filter(([, c]) => c.flag !== null)
    .map(([key, c]) => [c.flag, { ...c, caseKey: key }]),
);

export const CASE_FLAG_LIST = Object.keys(CASES_BY_FLAG);

/**
 * Which case a parsed argv selected. `happy` when no case flag was given.
 * @returns {{ caseKey: string, caseDef: object }}
 * @throws {Error} if more than one case flag was passed — running two cases in
 *   one invocation would report a single mangled outcome and move real USDC
 *   twice with one evidence trail.
 */
export function selectCase(caseKeys) {
  if (caseKeys.length > 1) {
    throw new Error(
      `Only one case flag per run — got ${caseKeys.length} (${caseKeys.join(", ")}). Each case asserts its own clean outcome and needs its own evidence trail.`,
    );
  }
  const caseKey = caseKeys[0] ?? "happy";
  return { caseKey, caseDef: CASES[caseKey] };
}
