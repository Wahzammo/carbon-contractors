/**
 * session-count.ts
 * Shared session counter — the MCP route sets it, health check reads it.
 * Avoids circular imports between API routes.
 */

let _count = 0;

export function setSessionCount(count: number): void {
  _count = count;
}

export function getSessionCount(): number {
  return _count;
}
