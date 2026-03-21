"use client";

import { type ReactNode } from "react";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { baseSepolia, base } from "wagmi/chains";

const chain =
  process.env.NEXT_PUBLIC_BASE_NETWORK === "mainnet" ? base : baseSepolia;

export function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      chain={chain}
      config={{
        appearance: {
          name: "Carbon Contractors",
          mode: "dark",
        },
      }}
    >
      {children}
    </OnchainKitProvider>
  );
}
