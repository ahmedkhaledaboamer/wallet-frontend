import { describe, expect, it } from "vitest";
import {
  flowReducer,
  initialFlowState,
  resumeWithTx,
  stepStates,
  type FlowEvent,
  type FlowState,
} from "@/lib/wallet/machine";

const run = (events: FlowEvent[], from: FlowState = initialFlowState) => events.reduce(flowReducer, from);
const ACCOUNT = "0x8ba1f109551bD432803012645Ac136ddd64DBA72";
const happyToConfirm: FlowEvent[] = [
  { type: "START" },
  { type: "CONNECTED", account: ACCOUNT },
  { type: "NETWORK_OK", balance: "10", allowance: "0" },
  { type: "APPROVE_SENT", hash: "0xapprove" },
  { type: "APPROVED", allowance: "5" },
  { type: "SIMULATED" },
];

describe("wallet flow state machine", () => {
  it("walks every step in order on the happy path", () => {
    const s = run([...happyToConfirm, { type: "TX_SENT", hash: "0xpay" }, { type: "REPORTED" }, { type: "FINAL", status: "completed" }]);
    expect(s.step).toBe("done");
    expect(s.status).toBe("done");
    expect(s.account).toBe(ACCOUNT);
    expect(s.approveTxHash).toBe("0xapprove");
    expect(s.txHash).toBe("0xpay");
    expect(s.reported).toBe(true);
    expect(Object.values(stepStates(s)).every((x) => x === "complete")).toBe(true);
  });

  it("skips approval when the allowance already covers the total", () => {
    const s = run([{ type: "START" }, { type: "CONNECTED", account: ACCOUNT }, { type: "NETWORK_OK", balance: "10", allowance: "10" }, { type: "APPROVE_SKIPPED" }]);
    expect(s.step).toBe("simulate");
    expect(s.approveSkipped).toBe(true);
    expect(stepStates(s).approve).toBe("skipped");
  });

  it("ignores events that don't belong to the current step", () => {
    const s = run([{ type: "START" }, { type: "SIMULATED" }, { type: "TX_SENT", hash: "0xpay" }]);
    expect(s.step).toBe("connect");
    expect(s.txHash).toBeUndefined();
  });

  it("does nothing before START", () => {
    expect(run([{ type: "CONNECTED", account: ACCOUNT }])).toEqual(initialFlowState);
  });

  it("tracks waiting-for-wallet while a signature is pending", () => {
    const s = run([{ type: "START" }, { type: "WAITING_WALLET" }]);
    expect(s.status).toBe("waitingWallet");
    expect(stepStates(s).connect).toBe("current");
    expect(run([{ type: "RUNNING" }], s).status).toBe("running");
  });

  it("records errors on the failing step and retries the same step", () => {
    const failed = run([...happyToConfirm, { type: "FAIL", error: { code: "userRejected" } }]);
    expect(failed.step).toBe("confirm");
    expect(failed.status).toBe("error");
    expect(stepStates(failed).confirm).toBe("error");
    expect(stepStates(failed).simulate).toBe("complete");

    const retried = run([{ type: "RETRY" }], failed);
    expect(retried.status).toBe("running");
    expect(retried.step).toBe("confirm");
    expect(retried.error).toBeUndefined();
  });

  it("RESET before signing starts over from connect", () => {
    const s = run([...happyToConfirm, { type: "FAIL", error: { code: "simulationFailed" } }, { type: "RESET" }]);
    expect(s).toEqual(initialFlowState);
  });

  it("never returns to a sending step once the payout tx exists", () => {
    const sent = run([...happyToConfirm, { type: "TX_SENT", hash: "0xpay" }, { type: "FAIL", error: { code: "backend" } }]);
    expect(sent.step).toBe("verify");
    const reset = run([{ type: "RESET" }], sent);
    expect(reset.step).toBe("verify");
    expect(reset.txHash).toBe("0xpay");
    const retried = run([{ type: "RETRY" }], sent);
    expect(retried.step).toBe("verify");
    // a second TX_SENT is impossible from verify
    expect(run([{ type: "TX_SENT", hash: "0xother" }], retried).txHash).toBe("0xpay");
  });

  it("only finishes after the tx is reported and the batch is final", () => {
    const sent = run([...happyToConfirm, { type: "TX_SENT", hash: "0xpay" }]);
    expect(run([{ type: "FINAL", status: "completed" }], { ...sent, txHash: undefined }).step).toBe("verify");
    expect(run([{ type: "REPORTED" }, { type: "FINAL", status: "completed_with_issues" }], sent).finalStatus).toBe("completed_with_issues");
  });

  it("resumes a pending payout in verify without re-sending", () => {
    const s = resumeWithTx("0xpay");
    expect(s.step).toBe("verify");
    expect(s.txHash).toBe("0xpay");
    const started = run([{ type: "START" }], s);
    expect(started.status).toBe("running");
    expect(stepStates(started).confirm).toBe("complete");
  });

  it("ignores FAIL once done", () => {
    const done = run([...happyToConfirm, { type: "TX_SENT", hash: "0xpay" }, { type: "REPORTED" }, { type: "FINAL", status: "completed" }]);
    expect(run([{ type: "FAIL", error: { code: "unknown" } }], done)).toBe(done);
  });
});
