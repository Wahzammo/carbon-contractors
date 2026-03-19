/**
 * reputation-abi.ts
 * ABI for the ReputationStake contract.
 * Hand-written from compiled artifact — matches contracts/ReputationStake.sol.
 */

export const REPUTATION_STAKE_ABI = [
  // Constructor
  {
    type: "constructor",
    inputs: [{ name: "_usdc", type: "address" }],
    stateMutability: "nonpayable",
  },

  // ── Write functions ──────────────────────────────────────────────────────

  {
    type: "function",
    name: "stake",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unstake",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "slash",
    inputs: [
      { name: "worker", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setMinStake",
    inputs: [{ name: "newMin", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },

  // ── Read functions ───────────────────────────────────────────────────────

  {
    type: "function",
    name: "getStake",
    inputs: [{ name: "worker", type: "address" }],
    outputs: [
      { name: "amount", type: "uint256" },
      { name: "stakedAt", type: "uint256" },
      { name: "slashedTotal", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "stakes",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "amount", type: "uint256" },
      { name: "stakedAt", type: "uint256" },
      { name: "slashedTotal", type: "uint256" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "usdc",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalStaked",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "minStake",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "COOLDOWN",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },

  // ── Events ───────────────────────────────────────────────────────────────

  {
    type: "event",
    name: "Staked",
    inputs: [
      { name: "worker", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "newTotal", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Unstaked",
    inputs: [
      { name: "worker", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "remaining", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Slashed",
    inputs: [
      { name: "worker", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "remaining", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "MinStakeUpdated",
    inputs: [
      { name: "oldMin", type: "uint256", indexed: false },
      { name: "newMin", type: "uint256", indexed: false },
    ],
  },

  // ── Errors ───────────────────────────────────────────────────────────────

  { type: "error", name: "ZeroAmount", inputs: [] },
  { type: "error", name: "BelowMinimumStake", inputs: [] },
  {
    type: "error",
    name: "CooldownNotElapsed",
    inputs: [{ name: "readyAt", type: "uint256" }],
  },
  { type: "error", name: "InsufficientStake", inputs: [] },
  { type: "error", name: "InvalidUnstakeAmount", inputs: [] },
] as const;
