"use client";

import { useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { Address, Avatar, Name, Identity } from "@coinbase/onchainkit/identity";
import styles from "./connect.module.css";

const AVAILABLE_SKILLS = [
  "solidity",
  "smart-contracts",
  "auditing",
  "typescript",
  "nextjs",
  "api-design",
  "zk-proofs",
  "circom",
  "cryptography",
  "python",
  "data-analysis",
  "ml",
  "defi",
  "subgraph",
  "rust",
  "golang",
  "design",
  "copywriting",
];

export default function ConnectPage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [rateUsdc, setRateUsdc] = useState("");
  const [status, setStatus] = useState<
    "idle" | "signing" | "submitting" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function toggleSkill(skill: string) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  }

  async function handleRegister() {
    if (!address || selectedSkills.length === 0 || !rateUsdc) return;

    setStatus("signing");
    setErrorMsg("");

    try {
      const message = JSON.stringify({
        action: "register_worker",
        wallet: address,
        skills: selectedSkills,
        rate_usdc: Number(rateUsdc),
        timestamp: Date.now(),
      });

      const signature = await signMessageAsync({ message });

      setStatus("submitting");

      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature, wallet: address }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Registration failed");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Carbon Contractors</h1>
        <Wallet>
          <ConnectWallet />
          <WalletDropdown>
            <Identity hasCopyAddressOnClick>
              <Avatar />
              <Name />
              <Address />
            </Identity>
            <WalletDropdownDisconnect />
          </WalletDropdown>
        </Wallet>
      </header>

      <main className={styles.main}>
        {!isConnected ? (
          <div className={styles.hero}>
            <h2>Register as a Worker</h2>
            <p>
              Connect your wallet to register your skills on the Base-Human
              whitepages. AI agents will be able to discover and hire you via
              MCP.
            </p>
            <p className={styles.subtle}>
              No seed phrases. No browser extensions. Just a passkey.
            </p>
          </div>
        ) : status === "success" ? (
          <div className={styles.hero}>
            <h2>Registered</h2>
            <p>
              Your wallet is now in the whitepages. AI agents can find you by
              your skills and hire you directly.
            </p>
            <p className={styles.mono}>{address}</p>
          </div>
        ) : (
          <div className={styles.form}>
            <h2>Your Skills</h2>
            <p>Select the skills you want to offer. Agents search by these.</p>
            <div className={styles.skills}>
              {AVAILABLE_SKILLS.map((skill) => (
                <button
                  key={skill}
                  className={`${styles.skill} ${selectedSkills.includes(skill) ? styles.skillActive : ""}`}
                  onClick={() => toggleSkill(skill)}
                  type="button"
                >
                  {skill}
                </button>
              ))}
            </div>

            <h2>Hourly Rate (USDC)</h2>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 150"
              value={rateUsdc}
              onChange={(e) => setRateUsdc(e.target.value)}
              className={styles.input}
            />

            <button
              className={styles.register}
              disabled={
                selectedSkills.length === 0 ||
                !rateUsdc ||
                status === "signing" ||
                status === "submitting"
              }
              onClick={handleRegister}
            >
              {status === "signing"
                ? "Sign with wallet..."
                : status === "submitting"
                  ? "Registering..."
                  : "Sign & Register"}
            </button>

            {status === "error" && (
              <p className={styles.error}>{errorMsg}</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
