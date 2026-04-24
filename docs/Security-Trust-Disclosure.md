# Security & Trust Disclosure: Zero-Secret Escrow Architecture

As a solo developer, I recognize that trust is the most critical component of an escrow system. Rather than asking you to trust me, I have built an architecture where trust is enforced by hardware and infrastructure — not by promises.

**The core guarantee:** No human — including me — can access, view, copy, or extract the private key that controls the escrow contracts. The key exists only inside a hardware security module. There are no static credentials, key files, or long-lived secrets anywhere in the system.

---

## How It Works

### 1. Hardware Security Module (HSM) — FIPS 140-2 Level 3

The escrow signing key is generated and stored inside a **Google Cloud HSM**.

- **Non-exportable:** The private key material never leaves the hardware. It cannot be viewed, downloaded, or copied — not by me, not by Google, not by anyone.
- **Hardware-enforced:** The HSM hardware itself performs the cryptographic signing. There is no digital file, string, or environment variable containing the private key.
- **Industry standard:** FIPS 140-2 Level 3 certification — the same standard used by financial institutions and government agencies.

### 2. Zero Static Credentials (Workload Identity Federation)

I do not use traditional credentials (API keys, service account JSON files, or stored secrets) to access the signing key. Instead, the system uses **OIDC federation** — the same zero-trust authentication pattern used by large enterprises.

- **No key files:** There are no JSON keys, API tokens, or static credentials stored anywhere — not in environment variables, not in code, not on my machine.
- **Short-lived tokens only:** Every signing operation uses a temporary token that expires within 45 minutes and cannot be reused.
- **Infrastructure-locked:** Only the specific production deployment of the Carbon Contractors platform can request signatures. The signing path is cryptographically bound to the correct application environment.
- **No human in the loop:** The authentication chain is machine-to-machine. I cannot manually invoke the signing key, even if I wanted to.

### 3. Dual Authentication Paths

The system has two separate, independently constrained authentication paths:

| Path | Purpose | Constraint |
|------|---------|-----------|
| **Runtime signing** | Escrow operations (fund, complete, dispute, expire) | Locked to the production deployment of the platform application |
| **Contract deployment** | Smart contract upgrades and deployments | Locked to the specific GitHub repository via CI/CD pipeline |

Both paths authenticate via OIDC federation to the same HSM key. Neither path involves static credentials.

### 4. Transparent Audit Trail

Every time the escrow key signs a transaction, a permanent, immutable log is generated in Google Cloud's audit system.

- Every signature is traceable to a specific operation and timestamp
- Signing rate is monitored with anomaly detection alerts
- Audit logs can be cross-referenced against on-chain transactions for full accountability

---

## What This Protects Against

| Threat | Protection |
|--------|-----------|
| Developer reads/leaks the key | Impossible — key exists only inside HSM hardware |
| Attacker compromises developer's machine | No key to steal, no credentials to exfiltrate |
| Attacker reads environment variables | Only non-sensitive configuration metadata is stored (project IDs, resource paths) — none are secrets |
| Physical coercion ("wrench attack") | Developer cannot reveal a key that does not exist as a string, and cannot produce credentials that only infrastructure can generate |
| Malicious code exfiltration | Nothing to exfiltrate — no key material, no JSON files, no static tokens |
| Insider abuse | Developer can trigger operations through the platform but cannot extract the key or bypass audit logging |

---

## Verification for Power Users

You do not have to take my word for any of this. The following artifacts are available for independent verification:

### HSM Attestation Bundle

A **cryptographically signed statement from the HSM hardware itself**, proving:

1. The key was generated inside a physical HSM
2. The key is set to non-exportable status
3. The key uses the correct algorithm (secp256k1) for Ethereum compatibility

This attestation is signed by Google's HSM infrastructure and can be independently verified against Google's published root certificates.

### On-Chain Verification

The Ethereum address derived from the KMS public key matches the owner/signer address on the deployed escrow contract. You can verify this yourself:

1. Check the contract owner address on Basescan
2. Compare against the published KMS-derived address
3. Confirm they match — proving the on-chain contract is controlled by the HSM key

### Zero-Credential Verification

The service account used for signing has **zero JSON keys** — this is verifiable and can be demonstrated via GCP IAM console screenshots or audit exports.

---

## Why This Matters

Traditional escrow systems ask you to trust the operator. This system removes the operator from the trust model entirely.

By moving trust from a **person** to **hardware and infrastructure** (GCP HSM + Workload Identity Federation + audited CI/CD), the escrow system remains secure even if my personal devices, accounts, or physical person are compromised. The only way to move funds is through the logic defined in the smart contracts, triggered by the audited platform application running in its verified production environment.

The key was born inside the HSM. It has never existed as a string, a file, or a variable. It never will.

---

*For technical inquiries regarding the security architecture, please open an issue on the project repository or contact the maintainer.*
