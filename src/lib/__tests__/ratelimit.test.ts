import { describe, it, expect, vi, beforeEach } from "vitest";

// Suppress log output
vi.mock("@/lib/logging", () => ({
  log: vi.fn(),
}));

describe("ratelimit", () => {
  beforeEach(() => {
    vi.resetModules();
    // Ensure no Upstash env vars for in-memory tests
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("creates in-memory limiter when Upstash is not configured", async () => {
    const { apiRateLimiter } = await import("@/lib/ratelimit");
    const result = await apiRateLimiter.limit("test-ip");
    expect(result.success).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it("tracks requests per key", async () => {
    const { challengeRateLimiter } = await import("@/lib/ratelimit");

    // Challenge limit is 10/min
    for (let i = 0; i < 10; i++) {
      const result = await challengeRateLimiter.limit("same-ip");
      expect(result.success).toBe(true);
    }

    // 11th should fail
    const blocked = await challengeRateLimiter.limit("same-ip");
    expect(blocked.success).toBe(false);
    expect(blocked.retryAfterS).toBeGreaterThan(0);
  });

  it("isolates different keys", async () => {
    const { challengeRateLimiter } = await import("@/lib/ratelimit");

    // Exhaust limit for ip-a
    for (let i = 0; i < 11; i++) {
      await challengeRateLimiter.limit("ip-a");
    }

    // ip-b should still be fine
    const result = await challengeRateLimiter.limit("ip-b");
    expect(result.success).toBe(true);
  });
});
