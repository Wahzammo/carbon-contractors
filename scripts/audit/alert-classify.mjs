/**
 * alert-classify.mjs — decide what a monitor run's results MEAN before anyone is paged.
 *
 * Extracted from run-monitors.mjs (CC-104) so the semantics are testable. The bug this
 * fixes was not in any monitor: it was in the last inch of the alerting path, where three
 * unrelated conditions — an invariant VIOLATED, a monitor that could not reach the chain,
 * and a monitor that could not run at all — were flattened into one webhook message whose
 * fixed footer said "First response is to PAUSE NEW TASK CREATION" (ADR-0003 D4).
 *
 * Measured before this module existed: 32 of 100 scheduled runs red, ZERO of them
 * invariant breaches — 29 transport (public-endpoint rate limiting, CC-048), the rest
 * the CC-082 redeploy window. Every one of those pages read like a solvency breach.
 * That is ADR-0003's own named failure mode — an alert channel nobody reads is not an
 * alert channel — arriving from the direction nobody was watching.
 *
 * The classes, worst-first (one run has exactly one class):
 *
 *   breach     a FAIL exists. An invariant was observed VIOLATED. Pause-intake guidance
 *              applies (ADR-0003 D4). Wake tier applies.
 *   misconfig  a MISCONFIG exists (or --strict with SKIPs). The check itself is broken or
 *              absent — the invariants it covers are UNCHECKED, not passing. Fix the
 *              config; do not debug the chain.
 *   unchecked  only TRANSIENT results failed. The monitors ran and could not look. No
 *              invariant was observed violated; none of the TRAN-covered ones are
 *              verified either. D3 makes this non-green, but it is not an incident.
 *   green      everything ran and passed.
 *
 * Exit codes do not distinguish these (GitHub Actions shows one shade of red); the
 * alert body and the `classification:` log line do.
 */

/** @typedef {"breach"|"misconfig"|"unchecked"|"green"} RunKind */

/**
 * Split results into their status classes. Pure.
 *
 * Accepts both "TRANSIENT" (the runner's internal status string) and "TRAN" (its display
 * icon) for the transport class — the runner predates this module and both spellings
 * appear in logs and captured output, so the classifier treats them as one fact.
 *
 * @param {Array<{status: string, tier?: string}>} results
 */
export function classifyResults(results) {
  const by = (s) => results.filter((r) => (Array.isArray(s) ? s.includes(r.status) : r.status === s));
  return {
    pass: by("PASS"),
    fail: by("FAIL"),
    misconfig: by("MISCONFIG"),
    transient: by(["TRANSIENT", "TRAN"]),
    skipped: by("SKIP"),
  };
}

/**
 * The run's single class. Worst wins: a breach with transport noise on top is still a
 * breach — but the body builder must still SAY the noisy monitors went unchecked, or the
 * reader assumes they passed.
 *
 * @param {ReturnType<typeof classifyResults>} c
 * @param {{strict?: boolean}} [opts]
 * @returns {RunKind}
 */
export function runKind(c, opts = {}) {
  if (c.fail.length > 0) return "breach";
  // --strict exists because a SKIP and a PASS look identical; under it, a skip is a
  // failure of coverage, which is the misconfig class's meaning.
  if (c.misconfig.length > 0 || (opts.strict && c.skipped.length > 0)) return "misconfig";
  if (c.transient.length > 0) return "unchecked";
  return "green";
}

const pauseIntake =
  "First response is to PAUSE NEW TASK CREATION, not to debug (ADR-0003 D4). Tasks already " +
  "in flight resolve safely on their own clocks; new ones would not. Never pause claims — " +
  "halting settlement mid-flight strands funds and inverts ADR-0001 D6.";

/**
 * Build the alert body for a classified run. Pure; no env, no clock, no network — the
 * caller supplies context so tests are hermetic (CC-060 discipline).
 *
 * @param {RunKind} kind
 * @param {ReturnType<typeof classifyResults>} c
 * @param {{results: Array<{name: string, status: string, verdict: string}>,
 *          started: string, network: string, ctx?: string|null,
 *          isDrill?: boolean, drillArgs?: string[]}} p
 * @returns {string}
 */
export function alertBody(kind, c, p) {
  const lines = [];
  const n = p.results.length;

  // A drill must never be mistakeable for an incident — same rule as before, now applied
  // to every class, because a drill of the unchecked path reads exactly like a real one.
  if (p.isDrill) {
    lines.push("🧪 **DRILL — NOT A REAL FAILURE.** Monitor thresholds were overridden by hand.");
    lines.push(`overrides: ${(p.drillArgs ?? []).join(" ")}`);
  }

  const head = {
    breach: () =>
      `Carbon Contractors INVARIANT BREACH — ${c.fail.length} of ${n} monitor(s) FAILED` +
      (c.fail.some((r) => r.tier === "wake") ? " (includes a wake-someone-up tier)" : ""),
    misconfig: () =>
      `Carbon Contractors MONITOR MISCONFIGURED — ${c.misconfig.length} of ${n} could not run correctly.` +
      " This is not an invariant verdict.",
    unchecked: () =>
      `Carbon Contractors invariant monitors: ${c.transient.length} of ${n} UNCHECKED (transport) — ` +
      "no invariant was observed violated.",
    green: () => `Carbon Contractors invariant monitors: all clear (${n} checked)`,
  };
  lines.push(head[kind]());
  lines.push(`network ${p.network} · ${p.started}`);

  for (const r of p.results) {
    lines.push(`${r.status === "PASS" ? "ok" : r.status.toLowerCase()} · ${r.name} · ${r.verdict}`);
  }

  if (kind === "breach") {
    lines.push("", pauseIntake);
    // Breach + noise: say which invariants went unverified while the fire burns.
    if (c.transient.length > 0) {
      lines.push(
        "",
        `Additionally ${c.transient.length} monitor(s) went UNCHECKED (transport) during this run — ` +
          "their invariants are unverified, not passing.",
      );
    }
  } else if (kind === "misconfig") {
    lines.push("");
    lines.push(
      "The affected invariant(s) are UNCHECKED, not passing (ADR-0003 D3: an unchecked " +
        "invariant and a passing one look identical). Fix the monitor configuration; do not " +
        "debug the chain. Runbook: docs/runbooks/INVARIANT-ALERTS.md §5.",
    );
  } else if (kind === "unchecked") {
    lines.push("");
    lines.push(
      "Transport failure, not a breach: the monitors ran and could not reach the chain. No " +
        "pause is required for a single occurrence. If UNCHECKED repeats on consecutive runs, " +
        "treat the affected invariants as unverified and investigate the RPC path " +
        "(runbook §6) — an unmonitored money path is not a steady state.",
    );
  }

  if (p.ctx) lines.push(p.ctx);
  return lines.join("\n");
}
