import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { WalletProviders } from "@/lib/wallet/providers";
import "@coinbase/onchainkit/styles.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
