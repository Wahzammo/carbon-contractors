import { describe, it, expect, vi, beforeEach } from "vitest";

describe("escrow helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("toTaskId produces deterministic bytes32 from payment_request_id", async () => {
    // Stub env so config doesn't throw
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "key");
    vi.stubEnv("NEXT_PUBLIC_ONCHAINKIT_API_KEY", "key");

    const { toTaskId } = await import("@/lib/contracts/escrow");
    const id1 = toTaskId("abc123");
    const id2 = toTaskId("abc123");
    const id3 = toTaskId("xyz789");

    expect(id1).toBe(id2); // deterministic
    expect(id1).not.toBe(id3); // different inputs → different outputs
    expect(id1).toMatch(/^0x[0-9a-f]{64}$/); // valid bytes32
  });

  it("getEscrowConfig returns null address when env not set", async () => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "key");
    vi.stubEnv("NEXT_PUBLIC_ONCHAINKIT_API_KEY", "key");
    vi.stubEnv("NEXT_PUBLIC_BASE_NETWORK", "testnet");

    const { getEscrowConfig } = await import("@/lib/contracts/escrow");
    const config = getEscrowConfig();
    expect(config.address).toBeNull();
    expect(config.chainId).toBeDefined();
  });

  it("getEscrowConfig returns address when env is set", async () => {
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "key");
    vi.stubEnv("NEXT_PUBLIC_ONCHAINKIT_API_KEY", "key");
    vi.stubEnv("NEXT_PUBLIC_ESCROW_CONTRACT", "0x1234567890123456789012345678901234567890");

    const { getEscrowConfig } = await import("@/lib/contracts/escrow");
    const config = getEscrowConfig();
    expect(config.address).toBe("0x1234567890123456789012345678901234567890");
  });
});
