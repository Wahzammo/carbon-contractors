/**
 * deploy/reputation-stake.ts
 * Deploys ReputationStake to Base Sepolia.
 *
 * Usage:
 *   npx hardhat run scripts/deploy/reputation-stake.ts --network baseSepolia
 *
 * Requires in .env.local:
 *   DEPLOYER_PRIVATE_KEY=0x...
 *   BASE_SEPOLIA_RPC_URL=https://sepolia.base.org  (optional, defaults to public RPC)
 */

import { ethers } from "hardhat";

// USDC on Base Sepolia (Circle's official test token)
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("Deployer has no ETH. Get some from faucet.base.org");
  }

  console.log("\nDeploying ReputationStake...");
  console.log("USDC address:", BASE_SEPOLIA_USDC);

  const ReputationStake = await ethers.getContractFactory("ReputationStake");
  const stake = await ReputationStake.deploy(BASE_SEPOLIA_USDC);
  await stake.waitForDeployment();

  const address = await stake.getAddress();
  console.log("\n✓ ReputationStake deployed to:", address);
  console.log("\nUpdate .env.local:");
  console.log(`  NEXT_PUBLIC_REPUTATION_STAKE_CONTRACT=${address}`);

  // Verify deployment
  const owner = await stake.owner();
  const usdc = await stake.usdc();
  const minStake = await stake.minStake();
  console.log("\nVerification:");
  console.log("  Owner:", owner);
  console.log("  USDC:", usdc);
  console.log("  Min stake:", ethers.formatUnits(minStake, 6), "USDC");
  console.log(
    "  USDC matches:",
    usdc.toLowerCase() === BASE_SEPOLIA_USDC.toLowerCase()
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
