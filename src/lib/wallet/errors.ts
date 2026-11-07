import { BaseError, ContractFunctionRevertedError, InsufficientFundsError, UserRejectedRequestError } from "viem";
import type { WalletError } from "./machine";

/** Thrown by flow steps for conditions we detect ourselves. */
export class FlowError extends Error {
  constructor(readonly walletError: WalletError) {
    super(walletError.code);
    this.name = "FlowError";
  }
}

function hasCode(e: unknown, code: number): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 8 && cur && typeof cur === "object"; i++) {
    if ((cur as { code?: unknown }).code === code) return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}

export function isUserRejection(e: unknown): boolean {
  if (e instanceof BaseError && e.walk((x) => x instanceof UserRejectedRequestError)) return true;
  return hasCode(e, 4001) || /user (rejected|denied)|rejected by user/i.test(String((e as Error)?.message ?? ""));
}

export function isUnknownChain(e: unknown): boolean {
  return hasCode(e, 4902) || /unrecognized chain|unknown chain/i.test(String((e as Error)?.message ?? ""));
}

/** Maps anything thrown inside a step to a user-facing wallet error. */
export function toWalletError(e: unknown, fallback: WalletError["code"] = "unknown"): WalletError {
  if (e instanceof FlowError) return e.walletError;
  if (isUserRejection(e)) return { code: "userRejected" };
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof InsufficientFundsError)) return { code: "insufficientGas" };
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null;
    if (revert) return { code: "simulationFailed", params: { reason: revert.reason ?? revert.shortMessage } };
    if (/chain mismatch|does not match the target chain/i.test(e.message)) return { code: "wrongNetwork" };
    return { code: fallback, params: { message: e.shortMessage, reason: e.shortMessage } };
  }
  const message = e instanceof Error ? e.message : String(e);
  return { code: fallback, params: { message, reason: message } };
}
