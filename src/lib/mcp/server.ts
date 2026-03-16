/**
 * server.ts
 * Singleton McpServer instance.
 * Registers all tools and resources for the Base-Human marketplace.
 * Output is intentionally terse and machine-optimized (no markdown, no prose).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchBySkill, getAllHumans } from "@/lib/db/whitepages";
import { initiateX402Payment } from "@/lib/payments/x402";

/**
 * Creates a fresh McpServer instance per session.
 * Each transport needs its own server — the SDK does not support
 * connecting a single McpServer to multiple transports simultaneously.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "base-human-mcp",
    version: "1.0.0",
  });

  // ─── Tool: search_whitepages ────────────────────────────────────────────────
  server.tool(
    "search_whitepages",
    "Query the Base-Human whitepages for verified wallet addresses by skill. Returns JSON array of matching humans sorted by reputation desc.",
    {
      skill: z
        .string()
        .min(1)
        .describe(
          "Skill slug to search for, e.g. 'solidity', 'typescript', 'zk-proofs'"
        ),
    },
    async ({ skill }) => {
      const results = await searchBySkill(skill);

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ok: false,
                skill,
                count: 0,
                results: [],
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: true,
              skill,
              count: results.length,
              results: results.map((h) => ({
                wallet: h.wallet,
                skills: h.skills,
                rate_usdc: h.rate_usdc,
                availability: h.availability,
                reputation_score: h.reputation_score,
              })),
            }),
          },
        ],
      };
    }
  );

  // ─── Tool: request_human_work ───────────────────────────────────────────────
  server.tool(
    "request_human_work",
    "Initiate an x402 escrow payment request on Base L2 to hire a verified human. Returns a payment_request_id and pending tx_hash. Funds are locked in escrow until task completion is confirmed.",
    {
      from_agent_wallet: z
        .string()
        .regex(/^0x[0-9a-fA-F]{40}$/)
        .describe("Agent's Base wallet address (0x…)"),
      to_human_wallet: z
        .string()
        .regex(/^0x[0-9a-fA-F]{40}$/)
        .describe("Human's Base wallet address from search_whitepages"),
      task_description: z
        .string()
        .min(10)
        .max(1000)
        .describe("Plain-text description of the task the human must complete"),
      amount_usdc: z
        .number()
        .positive()
        .describe("USDC amount to lock in escrow (whole units, e.g. 150)"),
      deadline_hours: z
        .number()
        .int()
        .min(1)
        .max(720)
        .describe("Deadline in hours from now (1–720)"),
    },
    async ({
      from_agent_wallet,
      to_human_wallet,
      task_description,
      amount_usdc,
      deadline_hours,
    }) => {
      const deadline_unix =
        Math.floor(Date.now() / 1000) + deadline_hours * 3600;

      try {
        const response = await initiateX402Payment({
          from_agent_wallet,
          to_human_wallet,
          task_description,
          amount_usdc,
          deadline_unix,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: true, ...response }),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: false, error: message }),
            },
          ],
        };
      }
    }
  );

  // ─── Resource: human_whitepages ─────────────────────────────────────────────
  server.resource(
    "human_whitepages",
    "base-human://whitepages/all",
    {
      description:
        "Full directory of all verified humans on Base. Structured JSON-RPC compatible.",
      mimeType: "application/json",
    },
    async () => {
      const all = await getAllHumans();
      return {
        contents: [
          {
            uri: "base-human://whitepages/all",
            mimeType: "application/json",
            text: JSON.stringify({
              protocol: "base-human-mcp/1.0",
              total: all.length,
              humans: all,
            }),
          },
        ],
      };
    }
  );

  return server;
}
