import { describe, expect, it } from "vitest";
import { encodeFunctionData, decodeFunctionData, toFunctionSelector, UserRejectedRequestError } from "viem";
import type { Batch, OnchainPayload } from "@/lib/api/schemas";
import { onchainPayloadSchema } from "@/lib/api/schemas";
import { batchPayoutAbi } from "@/lib/wallet/abi";
import { FlowError, toWalletError } from "@/lib/wallet/errors";
import { preparePayload, toBatchRef } from "@/lib/wallet/payload";

const a = (n: number) => `0x${String(n).repeat(40).slice(0, 40)}` as `0x${string}`;
const batch = { id: "PO-1", itemCount: 2, totalAmount: "100.5", network: "BEP20" } as Batch;
// Server sends RAW base units (18 decimals): 100 and 0.5 tokens.
const payload: OnchainPayload = {
  chainId: 97,
  contract: a(1),
  token: a(2),
  tokenDecimals: 18,
  treasury: a(3),
  batchRef: "0x" + "ab".repeat(32),
  recipients: [a(4), a(5)],
  amounts: ["100000000000000000000", "500000000000000000"],
  total: "100500000000000000000",
};

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof FlowError ? e.walletError.code : "other";
  }
  return "none";
};

describe("preparePayload (base units)", () => {
  it("passes base units through as BigInt without re-scaling", () => {
    const p = preparePayload(payload, batch, 97);
    expect(p.totalUnits).toBe(BigInt("100500000000000000000"));
    expect(p.amountUnits).toEqual([BigInt("100000000000000000000"), BigInt("500000000000000000")]);
  });

  it("uses tokenDecimals only to compare with the batch's decimal total", () => {
    // Same base units with 6 decimals mean a wildly different decimal total → must refuse.
    expect(code(() => preparePayload({ ...payload, tokenDecimals: 6 }, batch, 97))).toBe("payloadMismatch");
    const usdt6 = { ...payload, tokenDecimals: 6, amounts: ["100000000", "500000"], total: "100500000" };
    expect(preparePayload(usdt6, batch, 97).totalUnits).toBe(BigInt(100_500_000));
  });

  it.each([
    ["recipient count differs from the batch", { ...payload, recipients: [a(4)], amounts: [payload.total] }],
    ["amounts don't add up to total", { ...payload, amounts: ["100000000000000000000", "400000000000000000"] }],
    ["total differs from the approved batch", { ...payload, amounts: ["100000000000000000000", "1000000000000000000"], total: "101000000000000000000" }],
    ["chain differs from config", { ...payload, chainId: 1 }],
    ["an amount is zero", { ...payload, amounts: ["100500000000000000000", "0"] }],
  ])("refuses to sign when %s", (_, p) => {
    expect(code(() => preparePayload(p as OnchainPayload, batch, 97))).toBe("payloadMismatch");
  });

  it("schema rejects decimal (non-base-unit) amounts", () => {
    expect(onchainPayloadSchema.safeParse(payload).success).toBe(true);
    expect(onchainPayloadSchema.safeParse({ ...payload, amounts: ["100", "0.5"], total: "100.5" }).success).toBe(false);
  });

  it("uses a 32-byte hex batchRef as-is and hashes anything else", () => {
    expect(toBatchRef(payload.batchRef)).toBe(payload.batchRef);
    expect(toBatchRef("PO-1")).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("payout ABI", () => {
  it("encodes payout(bytes32 batchRef, IERC20 token, address[], uint256[]) with batchRef first", () => {
    const p = preparePayload(payload, batch, 97);
    const data = encodeFunctionData({
      abi: batchPayoutAbi,
      functionName: "payout",
      args: [p.batchRef, payload.token, payload.recipients, p.amountUnits],
    });
    expect(data.startsWith(toFunctionSelector("payout(bytes32,address,address[],uint256[])"))).toBe(true);
    const decoded = decodeFunctionData({ abi: batchPayoutAbi, data });
    expect(decoded.args[0]).toBe(payload.batchRef);
    expect(decoded.args[1].toLowerCase()).toBe(payload.token.toLowerCase());
    expect(decoded.args[3]).toEqual(p.amountUnits);
  });

  it("declares the BatchPaid event", () => {
    const ev = batchPayoutAbi.find((x) => x.type === "event");
    expect(ev?.name).toBe("BatchPaid");
    expect(ev?.inputs.map((i) => `${i.type}${i.indexed ? " indexed" : ""}`)).toEqual([
      "bytes32 indexed",
      "address indexed",
      "address indexed",
      "uint256",
      "uint256",
    ]);
  });
});

describe("toWalletError", () => {
  it("recognizes wallet rejections (EIP-1193 code 4001)", () => {
    expect(toWalletError(Object.assign(new Error("User rejected the request."), { code: 4001 })).code).toBe("userRejected");
    expect(toWalletError(new UserRejectedRequestError(new Error("no"))).code).toBe("userRejected");
  });

  it("passes our own flow errors through", () => {
    expect(toWalletError(new FlowError({ code: "wrongAccount", params: { account: "x", treasury: "y" } }))).toEqual({
      code: "wrongAccount",
      params: { account: "x", treasury: "y" },
    });
  });

  it("falls back to the step's default code", () => {
    expect(toWalletError(new Error("boom"), "switchFailed").code).toBe("switchFailed");
  });
});
