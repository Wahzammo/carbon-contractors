/**
 * x402-client.ts
 * Circuit breaker for x402 facilitator interactions.
 * NOR-182: Prevents cascading failures when x402.org is degraded or down.
 *
 * The circuit breaker has three states:
 *   CLOSED  — normal operation, requests pass through
 *   OPEN    — x402 is known-bad, fail fast without calling
 *   HALF_OPEN — after reset timeout, allow one probe request
 */

import { log } from "@/lib/logging";

const FAILURE_THRESHOLD = 3;
const RESET_AFTER_MS = 5 * 60 * 1000; // 5 minutes
const REQUEST_TIMEOUT_MS = 5_000; // 5 second timeout per request

let consecutiveFailures = 0;
let circuitOpenedAt: number | null = null;

type CircuitState = "closed" | "open" | "half_open";

export function getCircuitState(): CircuitState {
  if (!circuitOpenedAt) return "closed";
  if (Date.now() - circuitOpenedAt >= RESET_AFTER_MS) return "half_open";
  return "open";
}

/** For testing — reset circuit breaker state. */
export function _resetCircuitBreaker(): void {
  consecutiveFailures = 0;
  circuitOpenedAt = null;
}

/**
 * Execute a function with circuit breaker protection.
 * Throws if the circuit is open or the function fails beyond threshold.
 */
export async function withCircuitBreaker<T>(
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const state = getCircuitState();

  if (state === "open") {
    log("warn", "x402_circuit_open", {
      consecutive_failures: consecutiveFailures,
      opened_at: circuitOpenedAt,
    });
    throw new CircuitOpenError(
      "x402 circuit open — payment verification temporarily unavailable",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const result = await fn(controller.signal);
    // Success — reset failures
    consecutiveFailures = 0;
    circuitOpenedAt = null;
    return result;
  } catch (err) {
    consecutiveFailures++;
    log("warn", "x402_request_failed", {
      consecutive_failures: consecutiveFailures,
      threshold: FAILURE_THRESHOLD,
      error: err instanceof Error ? err.message : String(err),
    });

    if (consecutiveFailures >= FAILURE_THRESHOLD) {
      circuitOpenedAt = Date.now();
      log("error", "x402_circuit_opened", {
        consecutive_failures: consecutiveFailures,
      });
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Custom error class for circuit-open state.
 * Allows route handlers to distinguish circuit-open from other failures.
 */
export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitOpenError";
  }
}
