# Carbon Contractors

Human-as-a-Service infrastructure for the agentic web. AI agents autonomously discover, hire, and pay human workers through a standardised MCP interface, with payments settled in USDC on Base.

## What this is

Large language models can already write code, analyse data, and generate content. What they can't do is the physical, subjective, or trust-dependent work that still requires a human. Carbon Contractors bridges that gap.

Workers register their skills and hourly rates on-chain. AI agents query the worker registry via MCP (Model Context Protocol), select a worker, and lock USDC in escrow. When the task is done, funds release automatically. No platform middleman, no invoicing, no accounts payable.

The trust layer is reputation staking — workers put skin in the game, and their track record is public and verifiable. No KYC, no resumes, no interviews. Just wallets, skills, and outcomes.

## Architecture

```
AI Agent (Claude, GPT, etc.)
    │
    ▼
MCP Client ──── JSON-RPC / SSE ────► /api/mcp
                                        │
                            ┌───────────┼───────────┐
                            ▼           ▼           ▼
                     search_whitepages  │   human_whitepages
                                        │   (resource)
                                request_human_work
                                        │
                                        ▼
                                 x402 Escrow (Base L2)
                                        │
                                        ▼
                                  USDC Settlement
```

**MCP Tools:**
- `search_whitepages` — Query workers by skill, ranked by reputation
- `request_human_work` — Lock USDC in escrow to hire a worker

**MCP Resource:**
- `human_whitepages` — Full worker directory as structured JSON

The server speaks Streamable HTTP (SSE), not WebSocket. Any MCP-compatible client can connect — no custom SDK required.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Protocol | MCP over HTTP + SSE |
| Database | Supabase (Postgres) |
| Chain | Base L2 |
| Payments | USDC via x402 protocol |
| Identity | Coinbase Smart Wallet (passkeys, no seed phrases) |
| Agent SDK | Coinbase AgentKit |

## Running it locally

```bash
git clone https://github.com/Wahzammo/carbon-contractors.git
cd carbon-contractors
npm install
```

Create `.env.local` from the template:

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials (free tier works):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

Create the database tables by running `supabase/migrations/001_init.sql` in your Supabase SQL Editor, then seed the dev data:

```bash
npm run seed
npm run dev
```

The MCP endpoint is live at `http://localhost:3000/api/mcp`. Health check at `/api/health`.

## Testing the MCP server

Initialise a session:

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": {"name": "test", "version": "1.0.0"}
    }
  }'
```

Search for workers (use the `mcp-session-id` from the response headers):

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: YOUR_SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "search_whitepages",
      "arguments": {"skill": "solidity"}
    }
  }'
```

## Project status

- [x] MCP server with Streamable HTTP transport
- [x] Worker registry backed by Postgres (Supabase)
- [x] Skill search with reputation ranking
- [x] Task creation with payment persistence
- [x] Structured logging (Wazuh-compatible)
- [ ] Coinbase Smart Wallet integration (passkey auth)
- [ ] Worker self-registration flow
- [ ] On-chain USDC escrow contracts
- [ ] x402 payment protocol (live transactions)
- [ ] AgentKit autonomous agent wallets
- [ ] Reputation staking
- [ ] Task attestation and completion flow

## Design constraints

- **Zero PII** — no personal data stored, ever. Wallets and skills only.
- **Passkeys only** — no seed phrases, no SMS OTP. WebAuthn or nothing.
- **Escrow everything** — every task is wrapped in a smart contract. No trust required.
- **MCP-native** — any LLM with an MCP client can hire humans. No proprietary API.

## License

MIT
