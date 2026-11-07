import { isHex, keccak256, stringToHex, type Hex } from "viem";
import { compareDecimals, fromUnits } from "@/lib/amount";
import type { Batch, OnchainPayload } from "@/lib/api/schemas";
import { FlowError } from "./errors";

export interface PreparedPayload {
  payload: OnchainPayload;
  totalUnits: bigint;
  amountUnits: bigint[];
  batchRef: Hex;
}

/** bytes32 batch reference: used as-is when already 32-byte hex, otherwise hashed. */
export function toBatchRef(ref: string): Hex {
  if (isHex(ref) && ref.length === 66) return ref;
  return keccak256(stringToHex(ref));
}

/**
 * Defence in depth before anything is signed: the payload from the server must
 * describe exactly the batch the checker approved (count, total, chain).
 * `amounts` / `total` arrive as RAW BASE UNITS and go to the contract as-is
 * (never re-scaled here). tokenDecimals is used only to convert base units back
 * to a decimal for comparison with the batch and for display.
 */
export function preparePayload(payload: OnchainPayload, batch: Batch, expectedChainId?: number): PreparedPayload {
  const mismatch = () => new FlowError({ code: "payloadMismatch" });
  if (payload.recipients.length !== batch.itemCount || payload.amounts.length !== batch.itemCount) throw mismatch();
  if (expectedChainId !== undefined && payload.chainId !== expectedChainId) throw mismatch();
  const amountUnits = payload.amounts.map((a) => BigInt(a));
  const totalUnits = BigInt(payload.total);
  if (amountUnits.some((u) => u <= BigInt(0))) throw mismatch();
  if (amountUnits.reduce((acc, u) => acc + u, BigInt(0)) !== totalUnits) throw mismatch();
  if (compareDecimals(fromUnits(totalUnits, payload.tokenDecimals), batch.totalAmount) !== 0) throw mismatch();
  return { payload, totalUnits, amountUnits, batchRef: toBatchRef(payload.batchRef) };
}

/** Pending payout tx per batch, so a reload can never lead to paying twice. */
const PENDING_KEY = (batchId: string) => `apx.pending-tx.${batchId}`;

export function loadPendingTx(batchId: string): string | null {
  try {
    return localStorage.getItem(PENDING_KEY(batchId));
  } catch {
    return null;
  }
}
export function savePendingTx(batchId: string, hash: string) {
  try {
    localStorage.setItem(PENDING_KEY(batchId), hash);
  } catch {
    /* ignore */
  }
}
export function clearPendingTx(batchId: string) {
  try {
    localStorage.removeItem(PENDING_KEY(batchId));
  } catch {
    /* ignore */
  }
}
