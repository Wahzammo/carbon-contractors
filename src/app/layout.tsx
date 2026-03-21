import type { Metadata } from "next";
import { Inter_Tight, Doto } from "next/font/google";
import { WalletProviders } from "@/lib/wallet/providers";
import "@coinbase/onchainkit/styles.css";
import "./globals.css";

const interTight = Inter_Tight({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const doto = Doto({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Carbon Contractors",
  description:
    "Human-as-a-Service for the agentic web. AI agents hire humans via MCP, pay in USDC on Base.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${interTight.variable} ${doto.variable}`}>
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
