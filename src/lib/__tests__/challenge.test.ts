import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase before importing anything that uses it
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/db/client", () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
  }),
}));

// Mock viem
vi.mock("viem", () => ({
  recoverAddress: vi.fn(),
  hashMessage: vi.fn((msg: string) => `hashed:${msg}`),
}));

describe("MCP challenge-response auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("challenge endpoint", () => {
    it("rejects missing walletAddress", async () => {
      const { POST } = await import(
        "@/app/api/basedhuman.mcp/challenge/route"
      );

      const req = new Request("http://localhost/api/basedhuman.mcp/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      // Cast NextRequest-like for testing
      const res = await POST(req as any);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("walletAddress");
    });

    it("rejects invalid wallet format", async () => {
      const { POST } = await import(
        "@/app/api/basedhuman.mcp/challenge/route"
      );

      const req = new Request("http://localhost/api/basedhuman.mcp/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: "not-a-wallet" }),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(400);
    });

    it("issues challenge for valid wallet", async () => {
      mockFrom.mockReturnValue({
        delete: () => ({
          lt: () => Promise.resolve({ error: null }),
        }),
        insert: () => Promise.resolve({ error: null }),
      });

      const { POST } = await import(
        "@/app/api/basedhuman.mcp/challenge/route"
      );

      const req = new Request("http://localhost/api/basedhuman.mcp/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
        }),
      });

      const res = await POST(req as any);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.nonce).toBeDefined();
      expect(json.nonce.length).toBe(64); // 32 bytes hex
      expect(json.expiresAt).toBeDefined();
      expect(json.message).toContain("carbon-contractors.com");
      expect(json.message).toContain(json.nonce);
    });
  });
});
