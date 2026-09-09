import { describe, it, expect } from "vitest";
import { classifyResults, runKind, alertBody } from "../alert-classify.mjs";

// The shapes below are lifted from real scheduled runs, 2026-09-08 — see CC-104 for the
// forensic decode. Three red runs, zero breaches; the old alert path flattened all of
// them into "INVARIANT FAILURE ... pause new task creation".

const R = (name, status, verdict = "…", tier = "normal") => ({ name, status, verdict, tier });

const ctx = {
  started: "2026-09-08T01:12:44.000Z",
  network: "testnet",
  ctx: null,
  results: [],
};

describe("classifyResults", () => {
  it("buckets by status", () => {
    const c = classifyResults([
      R("verify-escrow-solvency", "PASS"),
      R("verify-unclaimed", "TRAN"),
      R("verify-eas-schema", "SKIP"),
      R("verify-contract-owner", "MISCONFIG"),
      R("verify-checker", "FAIL"),
    ]);
    expect(c.pass.map((r) => r.name)).toEqual(["verify-escrow-solvency"]);
    expect(c.transient.map((r) => r.name)).toEqual(["verify-unclaimed"]);
    expect(c.skipped.map((r) => r.name)).toEqual(["verify-eas-schema"]);
    expect(c.misconfig.map((r) => r.name)).toEqual(["verify-contract-owner"]);
    expect(c.fail.map((r) => r.name)).toEqual(["verify-checker"]);
  });
});

describe("runKind — worst wins", () => {
  it("a FAIL is a breach even with transport noise on top", () => {
    const c = classifyResults([R("solvency", "FAIL"), R("unclaimed", "TRAN"), R("eas", "SKIP")]);
    expect(runKind(c)).toBe("breach");
  });

  it("MISCONFIG without FAIL is misconfig, not unchecked", () => {
    const c = classifyResults([R("solvency", "PASS"), R("signer", "MISCONFIG")]);
    expect(runKind(c)).toBe("misconfig");
  });

  it("transient-only is unchecked — the exact shape of the 2026-09-08 pages", () => {
    const c = classifyResults([
      R("solvency", "PASS"),
      R("owner", "PASS"),
      R("signer", "PASS"),
      R("unclaimed", "TRAN", "TRANSIENT — RPC unreachable after retries"),
      R("concurrent", "TRAN", "TRANSIENT — RPC unreachable after retries"),
      R("eas", "SKIP"),
    ]);
    expect(runKind(c)).toBe("unchecked");
  });

  it("all PASS (skips allowed) is green", () => {
    const c = classifyResults([R("a", "PASS"), R("b", "SKIP")]);
    expect(runKind(c)).toBe("green");
  });

  it("skips are fatal only under --strict", () => {
    const c = classifyResults([R("a", "PASS"), R("eas", "SKIP")]);
    expect(runKind(c)).toBe("green");
    expect(runKind(c, { strict: true })).toBe("misconfig");
  });
});

describe("alertBody — the last inch", () => {
  it("breach keeps the pause-intake guidance (ADR-0003 D4)", () => {
    const results = [
      R("verify-escrow-solvency", "FAIL", "DEFICIT — balance below totalLocked", "wake"),
      R("verify-checker", "PASS", "CLEAN"),
    ];
    const c = classifyResults(results);
    const body = alertBody("breach", c, { ...ctx, results });
    expect(body).toContain("INVARIANT BREACH");
    expect(body).toContain("wake-someone-up");
    expect(body).toContain("PAUSE NEW TASK CREATION");
    expect(body).not.toContain("not an incident");
  });

  it("breach with transport noise says which monitors went unchecked", () => {
    const results = [
      R("verify-escrow-solvency", "FAIL", "DEFICIT", "wake"),
      R("verify-unclaimed", "TRAN", "TRANSIENT — RPC unreachable"),
    ];
    const c = classifyResults(results);
    const body = alertBody("breach", c, { ...ctx, results });
    expect(body).toContain("PAUSE NEW TASK CREATION");
    expect(body).toContain("1 monitor(s) went UNCHECKED");
  });

  it("unchecked does NOT page with pause-intake guidance — the fix itself", () => {
    // Run 34175850514 verbatim in shape: 5 pass, 2 TRAN, 1 SKIP.
    const results = [
      R("verify-escrow-solvency", "PASS", "CLEAN — balance equals totalLocked."),
      R("verify-contract-owner", "PASS", "PASS — HSM-owned."),
      R("verify-signer", "PASS", "CLEAN — signer configured."),
      R("verify-unclaimed", "TRAN", "TRANSIENT — RPC unreachable after retries: RPC Request failed."),
      R("verify-concurrent-escrow", "TRAN", "TRANSIENT — RPC unreachable after retries: RPC Request failed."),
      R("verify-eas-schema", "SKIP", "missing env: EAS_SCHEMA_REGISTRY_ADDRESS"),
      R("verify-checker", "PASS", "PASS — 7 canary case(s) match."),
      R("verify-sanctions", "PASS", "PASS — 0 matches across 10 screened."),
    ];
    const c = classifyResults(results);
    const body = alertBody("unchecked", c, { ...ctx, results });
    expect(body).toContain("UNCHECKED (transport)");
    expect(body).toContain("no invariant was observed violated");
    expect(body).not.toContain("PAUSE NEW TASK CREATION");
    expect(body).not.toContain("INVARIANT FAILURE");
    expect(body).toContain("consecutive");
  });

  it("misconfig says unchecked-not-passing and points at config, not the chain", () => {
    const results = [R("verify-signer", "MISCONFIG", "MISCONFIGURED: getTask read failed")];
    const c = classifyResults(results);
    const body = alertBody("misconfig", c, { ...ctx, results });
    expect(body).toContain("MONITOR MISCONFIGURED");
    expect(body).toContain("not an invariant verdict");
    expect(body).not.toContain("PAUSE NEW TASK CREATION");
  });

  it("green stays quiet-shaped", () => {
    const results = [R("a", "PASS", "CLEAN")];
    const c = classifyResults(results);
    const body = alertBody("green", c, { ...ctx, results });
    expect(body).toContain("all clear");
    expect(body).not.toContain("PAUSE");
  });

  it("a drill is labelled as a drill in every class", () => {
    const results = [R("verify-unclaimed", "FAIL", "VIOLATION — 1 problem(s)")];
    const c = classifyResults(results);
    const body = alertBody("breach", c, { ...ctx, results, isDrill: true, drillArgs: ["--max-age-days=0.001"] });
    expect(body).toContain("DRILL — NOT A REAL FAILURE");
    expect(body).toContain("--max-age-days=0.001");
  });

  it("product name is never mangled", () => {
    const body = alertBody("unchecked", classifyResults([R("a", "TRAN")]), {
      ...ctx,
      results: [R("a", "TRAN")],
    });
    expect(body).not.toMatch(/Carbon Consultants/);
  });
});
