import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  withCircuitBreaker,
  CircuitOpenError,
  getCircuitState,
  _resetCircuitBreaker,
} from "@/lib/x402-client";

// Suppress log output in tests
vi.mock("@/lib/logging", () => ({
  log: vi.fn(),
}));

describe("x402 circuit breaker", () => {
  beforeEach(() => {
    _resetCircuitBreaker();
  });

  it("starts in closed state", () => {
    expect(getCircuitState()).toBe("closed");
  });

  it("passes through successful calls", async () => {
    const result = await withCircuitBreaker(async () => "ok");
    expect(result).toBe("ok");
    expect(getCircuitState()).toBe("closed");
  });

  it("opens after 3 consecutive failures", async () => {
    const fail = () =>
      withCircuitBreaker(async () => {
        throw new Error("x402 down");
      });

    await expect(fail()).rejects.toThrow("x402 down");
    expect(getCircuitState()).toBe("closed");

    await expect(fail()).rejects.toThrow("x402 down");
    expect(getCircuitState()).toBe("closed");

    await expect(fail()).rejects.toThrow("x402 down");
    expect(getCircuitState()).toBe("open");
  });

  it("rejects immediately when circuit is open", async () => {
    // Trip the circuit
    for (let i = 0; i < 3; i++) {
      try {
        await withCircuitBreaker(async () => { throw new Error("fail"); });
      } catch { /* expected */ }
    }

    await expect(
      withCircuitBreaker(async () => "should not run"),
    ).rejects.toThrow(CircuitOpenError);
  });

  it("resets to closed after a successful call", async () => {
    // Trip the circuit partially (2 failures)
    for (let i = 0; i < 2; i++) {
      try {
        await withCircuitBreaker(async () => { throw new Error("fail"); });
      } catch { /* expected */ }
    }

    // Success resets the counter
    await withCircuitBreaker(async () => "ok");
    expect(getCircuitState()).toBe("closed");

    // Two more failures shouldn't trip it
    for (let i = 0; i < 2; i++) {
      try {
        await withCircuitBreaker(async () => { throw new Error("fail"); });
      } catch { /* expected */ }
    }
    expect(getCircuitState()).toBe("closed");
  });
});
