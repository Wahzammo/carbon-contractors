import { NextRequest, NextResponse } from "next/server";
import { getHumanByWallet } from "@/lib/db/whitepages";

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");

  if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json(
      { ok: false, error: "Valid wallet address required" },
      { status: 400 },
    );
  }

  const human = await getHumanByWallet(wallet);

  if (!human) {
    return NextResponse.json(
      { ok: false, error: "Worker not registered" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    profile: {
      wallet: human.wallet,
      categories: human.categories,
      rate_usdc: human.rate_usdc,
      availability: human.availability,
    },
  });
}
