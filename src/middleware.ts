/**
 * middleware.ts
 * Rate limiting for API endpoints.
 * Uses in-memory sliding window per IP — resets on cold start (acceptable for MVP).
 *
 * Runs on edge runtime — must NOT import Node.js modules (e.g., config.ts).
 */

import { NextRequest, NextResponse } from "next/server";

interface WindowEntry {
  count: number;
  windowStart: number;
}

const rateLimitMap = new Map<string, WindowEntry>();

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10);
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "60", 10);

export function middleware(req: NextRequest): NextResponse | undefined {
  // Exempt health check from rate limiting
  if (req.nextUrl.pathname === "/api/health") {
    return undefined;
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    // New window
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return undefined;
  }

  entry.count++;

  if (entry.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    return new NextResponse(
      JSON.stringify({ ok: false, error: "Too many requests" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  return undefined;
}

export const config = {
  matcher: ["/api/:path*"],
};
