"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import styles from "./BuyMeACoffee.module.css";

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}`;
const TIP_WALLET = process.env.NEXT_PUBLIC_TIP_WALLET_ADDRESS as `0x${string}`;

const AMOUNTS = [
  { label: "$2", value: BigInt(2_000_000) },
  { label: "$5", value: BigInt(5_000_000) },
  { label: "$10", value: BigInt(10_000_000) },
] as const;

type TxState = "idle" | "pending" | "confirming" | "success" | "error";

export default function BuyMeACoffee() {
  const { isConnected } = useAccount();
  const { writeContract, data: hash, error: writeError, reset } = useWriteContract();
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash });

  const [state, setState] = useState<TxState>("idle");
  const [activeAmount, setActiveAmount] = useState<string | null>(null);

  useEffect(() => {
    if (txConfirmed) {
      setState("success");
      const timer = setTimeout(() => {
        setState("idle");
        setActiveAmount(null);
        reset();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [txConfirmed, reset]);

  useEffect(() => {
    if (writeError) {
      setState("error");
      const timer = setTimeout(() => {
        setState("idle");
        setActiveAmount(null);
        reset();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [writeError, reset]);

  useEffect(() => {
    if (hash && state === "pending") {
      setState("confirming");
    }
  }, [hash, state]);

  function handleTip(label: string, amount: bigint) {
    if (!isConnected || !TIP_WALLET || !USDC_ADDRESS) return;
    setActiveAmount(label);
    setState("pending");
    writeContract({
      address: USDC_ADDRESS,
      abi: ERC20_TRANSFER_ABI,
      functionName: "transfer",
      args: [TIP_WALLET, amount],
    });
  }

  if (!TIP_WALLET || !USDC_ADDRESS) return null;

  return (
    <div className={styles.container}>
      <span className={styles.heading}>BUY ME A COFFEE</span>
      <div className={styles.buttons}>
        {AMOUNTS.map(({ label, value }) => {
          const isActive = activeAmount === label;
          const disabled = !isConnected || (state !== "idle" && state !== "success" && state !== "error");

          return (
            <button
              key={label}
              className={`${styles.btn} ${isActive && state === "success" ? styles.btnSuccess : ""}`}
              disabled={disabled}
              onClick={() => handleTip(label, value)}
              title={isConnected ? `Send ${label} USDC` : "Connect wallet first"}
            >
              {isActive && state === "pending" && "SIGNING..."}
              {isActive && state === "confirming" && "CONFIRMING..."}
              {isActive && state === "success" && "SENT!"}
              {isActive && state === "error" && "FAILED"}
              {(!isActive || state === "idle") && `${label} USDC`}
            </button>
          );
        })}
      </div>
      {!isConnected && (
        <span className={styles.hint}>CONNECT WALLET TO TIP</span>
      )}
    </div>
  );
}
