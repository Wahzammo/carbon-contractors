import { getSupabase } from "@/lib/db/client";
import { getTotalLocked, getEscrowConfig } from "@/lib/contracts/escrow";
import { getSessionCount } from "@/lib/mcp/session-count";

const startTime = Date.now();

interface HealthCheck {
  ok: boolean;
  latency_ms?: number;
  error?: string;
  count?: number;
}

export async function GET(): Promise<Response> {
  const checks: Record<string, HealthCheck> = {};

  // 1. Supabase connectivity
  const dbStart = Date.now();
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("humans").select("id").limit(1);
    checks.database = { ok: !error, latency_ms: Date.now() - dbStart };
    if (error) checks.database.error = error.message;
  } catch (err) {
    checks.database = {
      ok: false,
      latency_ms: Date.now() - dbStart,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // 2. Escrow contract read (if configured)
  const escrowConfig = getEscrowConfig();
  if (escrowConfig.address) {
    const chainStart = Date.now();
    try {
      await getTotalLocked();
      checks.escrow_contract = { ok: true, latency_ms: Date.now() - chainStart };
    } catch (err) {
      checks.escrow_contract = {
        ok: false,
        latency_ms: Date.now() - chainStart,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // 3. Session count
  checks.sessions = { ok: true, count: getSessionCount() };

  const allOk = Object.values(checks).every((c) => c.ok);

  return Response.json(
    {
      ok: allOk,
      version: "0.1.0",
      uptime_ms: Date.now() - startTime,
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
