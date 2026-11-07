import { erc20Abi } from "viem";

export { erc20Abi };

/**
 * Batch payout contract (confirmed by the backend team).
 * `payout` pulls sum(amounts) of `token` from the caller (treasury) and pays
 * each recipient; `BatchPaid` is emitted once per batch.
 */
export const batchPayoutAbi = [
  {
    type: "function",
    name: "payout",
    stateMutability: "nonpayable",
    inputs: [
      { name: "batchRef", type: "bytes32" },
      { name: "token", type: "address" }, // IERC20
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "BatchPaid",
    inputs: [
      { name: "batchRef", type: "bytes32", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "payer", type: "address", indexed: true },
      { name: "total", type: "uint256", indexed: false },
      { name: "count", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
