import { describe, it, expect } from "vitest";
import { getSessionCount, setSessionCount } from "@/lib/mcp/session-count";

describe("session-count", () => {
  it("starts at 0", () => {
    expect(getSessionCount()).toBe(0);
  });

  it("tracks set value", () => {
    setSessionCount(5);
    expect(getSessionCount()).toBe(5);
  });

  it("updates on change", () => {
    setSessionCount(10);
    expect(getSessionCount()).toBe(10);
    setSessionCount(3);
    expect(getSessionCount()).toBe(3);
  });

  it("can be reset to 0", () => {
    setSessionCount(42);
    setSessionCount(0);
    expect(getSessionCount()).toBe(0);
  });
});
