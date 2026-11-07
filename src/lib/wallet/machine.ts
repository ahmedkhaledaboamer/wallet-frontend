/**
 * Trust Wallet pay flow as a pure state machine (no I/O), so every transition
 * — including failure and retry semantics — is unit-testable.
 *
 * Safety invariant: once the payout transaction hash exists, the machine can
 * never return to a step that would send it again. Retry / reset from that
 * point only re-attempts reporting + verification.
 */

export const STEPS = ["connect", "network", "approve", "simulate", "confirm", "verify", "done"] as const;
export type StepId = (typeof STEPS)[number];

export type WalletErrorCode =
  | "userRejected"
  | "wrongAccount"
  | "wrongNetwork"
  | "switchFailed"
  | "insufficientBalance"
  | "insufficientGas"
  | "simulationFailed"
  | "payloadMismatch"
  | "txReverted"
  | "noProvider"
  | "backend"
  | "unknown";

export interface WalletError {
  code: WalletErrorCode;
  params?: Record<string, string>;
}

export type FlowStatus = "idle" | "running" | "waitingWallet" | "error" | "done";

export interface FlowState {
  step: StepId;
  status: FlowStatus;
  error?: WalletError;
  account?: string;
  /** Token amounts as base-unit strings (bigint-safe, serializable). */
  balance?: string;
  allowance?: string;
  approveSkipped: boolean;
  approveTxHash?: string;
  /** Payout transaction hash. Once set, the payout must never be re-sent. */
  txHash?: string;
  /** Whether POST /transaction succeeded for txHash. */
  reported: boolean;
  finalStatus?: string;
}

export type FlowEvent =
  | { type: "START" }
  | { type: "WAITING_WALLET" }
  | { type: "RUNNING" }
  | { type: "CONNECTED"; account: string }
  | { type: "NETWORK_OK"; balance: string; allowance: string }
  | { type: "APPROVE_SKIPPED" }
  | { type: "APPROVE_SENT"; hash: string }
  | { type: "APPROVED"; allowance: string }
  | { type: "SIMULATED" }
  | { type: "TX_SENT"; hash: string }
  | { type: "REPORTED" }
  | { type: "FINAL"; status: string }
  | { type: "FAIL"; error: WalletError }
  | { type: "RETRY" }
  | { type: "RESET" };

export const initialFlowState: FlowState = { step: "connect", status: "idle", approveSkipped: false, reported: false };

/** Resume a flow whose payout tx was already sent (e.g. after a reload before reporting). */
export function resumeWithTx(txHash: string): FlowState {
  return { ...initialFlowState, step: "verify", status: "idle", txHash, reported: false };
}

export const stepIndex = (s: StepId) => STEPS.indexOf(s);

/** Event → [step it is valid in, step it advances to]. */
const ADVANCE: Partial<Record<FlowEvent["type"], [StepId, StepId]>> = {
  CONNECTED: ["connect", "network"],
  NETWORK_OK: ["network", "approve"],
  APPROVE_SKIPPED: ["approve", "simulate"],
  APPROVED: ["approve", "simulate"],
  SIMULATED: ["simulate", "confirm"],
  TX_SENT: ["confirm", "verify"],
};

export function flowReducer(state: FlowState, event: FlowEvent): FlowState {
  switch (event.type) {
    case "START":
      if (state.status !== "idle") return state;
      return { ...state, status: "running", error: undefined };

    case "WAITING_WALLET":
      return state.status === "running" ? { ...state, status: "waitingWallet" } : state;

    case "RUNNING":
      return state.status === "waitingWallet" ? { ...state, status: "running" } : state;

    case "APPROVE_SENT":
      if (state.step !== "approve" || !isActive(state)) return state;
      return { ...state, approveTxHash: event.hash, status: "running" };

    case "REPORTED":
      if (state.step !== "verify" || !state.txHash) return state;
      return { ...state, reported: true, status: "running", error: undefined };

    case "FINAL":
      if (state.step !== "verify" || !state.txHash) return state;
      return { ...state, step: "done", status: "done", finalStatus: event.status, error: undefined };

    case "FAIL":
      if (state.status === "done" || state.status === "idle") return state;
      return { ...state, status: "error", error: event.error };

    case "RETRY":
      if (state.status !== "error") return state;
      return { ...state, status: "running", error: undefined };

    case "RESET":
      // After the payout tx exists, "start over" may only re-verify — never re-pay.
      if (state.txHash) return { ...state, step: "verify", status: "running", error: undefined };
      return initialFlowState;

    default: {
      const rule = ADVANCE[event.type];
      if (!rule || state.step !== rule[0] || !isActive(state)) return state;
      const next: FlowState = { ...state, step: rule[1], status: "running", error: undefined };
      if (event.type === "CONNECTED") next.account = event.account;
      if (event.type === "NETWORK_OK") Object.assign(next, { balance: event.balance, allowance: event.allowance });
      if (event.type === "APPROVE_SKIPPED") next.approveSkipped = true;
      if (event.type === "APPROVED") next.allowance = event.allowance;
      if (event.type === "TX_SENT") Object.assign(next, { txHash: event.hash, reported: false });
      return next;
    }
  }
}

function isActive(s: FlowState) {
  return s.status === "running" || s.status === "waitingWallet";
}

export type StepState = "pending" | "current" | "complete" | "error" | "skipped";

/** Visual state of each stepper row. */
export function stepStates(state: FlowState): Record<StepId, StepState> {
  const current = stepIndex(state.step);
  const out = {} as Record<StepId, StepState>;
  for (const s of STEPS) {
    const i = stepIndex(s);
    if (state.status === "done") out[s] = s === "approve" && state.approveSkipped ? "skipped" : "complete";
    else if (i < current) out[s] = s === "approve" && state.approveSkipped ? "skipped" : "complete";
    else if (i === current) out[s] = state.status === "error" ? "error" : state.status === "idle" ? "pending" : "current";
    else out[s] = "pending";
  }
  return out;
}
