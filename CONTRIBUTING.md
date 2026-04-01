# Contributing to Carbon Contractors

## Project Status: Active Development

> **Last updated:** April 2026

Carbon Contractors is a solo-developer learning project and portfolio piece — a Human-as-a-Service (HaaS) marketplace on Base where AI agents discover, hire, and pay human contractors via USDC and the x402 payment protocol.

This is my first Web3 project. It exists because building is the best way to learn. The code is public because transparency builds credibility, not because I'm seeking a contributor army.

---

## What I'll Review

- **Security fixes** — always welcome, always prioritised
- **Bug fixes** — if something's broken, I want to know
- **Documentation improvements** — typos, clarity, better examples
- **Dependency updates** — keeping the supply chain clean matters

## What I Probably Won't Review

- **Feature PRs** — the feature set is intentionally lean (8–9 MCP tools, focused phases). Unsolicited feature additions will likely sit unreviewed. If you have an idea, open an issue first to discuss before writing code.
- **UI/UX overhauls** — the cyberpunk aesthetic is deliberate. Polish PRs are welcome; redesigns aren't.
- **Refactors without a bug** — if it works and it's secure, it ships.

## Before You Open a PR

1. **Check Linear or GitHub Issues first** — the issue may already be tracked
2. **One concern per PR** — keep it focused
3. **Include context** — what's broken, what you changed, why
4. **Run the existing checks:**
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   ```

## Smart Contract Changes

Changes to `CarbonEscrow.sol` or any Solidity in `contracts/` require extra scrutiny. If you're proposing a contract change:

- Explain the security implications in your PR description
- Include or update test coverage
- Run Slither locally if you have it: `slither .`
- Understand that contract changes may take longer to review

## Response Times

I'm a solo maintainer with a full-time job and young kids. Expect:

- **Security issues:** reviewed within days (use the process in `SECURITY.md`)
- **Bug fixes:** reviewed within 1–2 weeks
- **Everything else:** when I get to it, no promises

If response time is a blocker for you, fork it. That's what public repos are for.

## Sponsoring an Audit

No formal third-party audit has been conducted on this project. If you or your organisation want to sponsor a professional security audit of the smart contracts or platform, that's a meaningful contribution I'd welcome. Open an issue or reach out directly.

## Code of Conduct

Don't be a dick. That's the whole policy.

If you're interacting with this repo — issues, PRs, discussions — be respectful, be constructive, and remember there's one person on the other end of every notification.

## License

Check `LICENSE` in the repo root for terms governing contributions.

---

*Built by [wahzammo](https://github.com/wahzammo) under [North Metro Tech](https://github.com/North-Metro-Tech).*
