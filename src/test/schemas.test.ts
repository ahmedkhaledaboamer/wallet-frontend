import { describe, expect, it } from "vitest";
import { createApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import {
  batchSchema,
  configSchema,
  onchainPayloadSchema,
  pageSchema,
  validationResultSchema,
  batchItemSchema,
  apiErrorBodySchema,
} from "@/lib/api/schemas";
import type { Transport, TransportResponse } from "@/lib/api/transport";

const user = { id: "u1", name: "Sara", role: "maker" };
const batch = {
  id: "PO-1",
  channel: "mexc",
  status: "draft",
  asset: "USDT",
  network: "TRC20",
  totalAmount: "100.50",
  itemCount: 2,
  paidCount: 0,
  failedCount: 0,
  reconciliationCount: 0,
  createdBy: user,
  createdAt: "2026-11-07T10:00:00.000Z",
};

describe("batchSchema", () => {
  it("accepts a contract-shaped batch", () => {
    expect(batchSchema.parse(batch).totalAmount).toBe("100.50");
  });

  it("treats null optional fields as absent", () => {
    const parsed = batchSchema.parse({ ...batch, approvedBy: null, txHash: null, approvedAt: null });
    expect(parsed.approvedBy).toBeUndefined();
    expect(parsed.txHash).toBeUndefined();
  });

  it("rejects numeric amounts (must be strings)", () => {
    expect(batchSchema.safeParse({ ...batch, totalAmount: 100.5 }).success).toBe(false);
  });

  it("rejects unknown enum values", () => {
    expect(batchSchema.safeParse({ ...batch, status: "paid" }).success).toBe(false);
    expect(batchSchema.safeParse({ ...batch, network: "SOL" }).success).toBe(false);
    expect(batchSchema.safeParse({ ...batch, channel: "binance" }).success).toBe(false);
  });

  it("accepts ISO dates with offsets but rejects free-form dates", () => {
    expect(batchSchema.safeParse({ ...batch, createdAt: "2026-11-07T12:00:00+02:00" }).success).toBe(true);
    expect(batchSchema.safeParse({ ...batch, createdAt: "07/11/2026" }).success).toBe(false);
  });

  it("normalizes numeric ids to strings", () => {
    expect(batchSchema.parse({ ...batch, id: 42 }).id).toBe("42");
  });
});

describe("other contract schemas", () => {
  it("parses a page envelope", () => {
    const page = pageSchema(batchItemSchema).parse({
      data: [{ id: "i1", reference: "WD-1", address: "T".padEnd(34, "a"), amount: "1", status: "pending" }],
      meta: { page: 1, pageSize: 50, total: 1 },
    });
    expect(page.data[0].status).toBe("pending");
  });

  it("requires environment = testnet in config", () => {
    const cfg = { environment: "testnet", dryRun: true, networks: [], maxRows: 500, maxBatchTotal: "1000" };
    expect(configSchema.safeParse(cfg).success).toBe(true);
    expect(configSchema.safeParse({ ...cfg, environment: "mainnet" }).success).toBe(false);
  });

  it("validates validation results with row errors", () => {
    const r = validationResultSchema.parse({ valid: false, rowCount: 3, totalAmount: "0", errors: [{ row: 3, messages: ["bad"] }] });
    expect(r.errors[0].row).toBe(3);
  });

  it("rejects an on-chain payload whose recipients and amounts differ in length", () => {
    const a = "0x" + "1".repeat(40);
    const base = { chainId: 97, contract: a, token: a, tokenDecimals: 18, treasury: a, batchRef: "x", total: "2" }; // base units
    expect(onchainPayloadSchema.safeParse({ ...base, recipients: [a, a], amounts: ["1", "1"] }).success).toBe(true);
    expect(onchainPayloadSchema.safeParse({ ...base, recipients: [a], amounts: ["1", "1"] }).success).toBe(false);
    expect(onchainPayloadSchema.safeParse({ ...base, recipients: ["0x123"], amounts: ["1"] }).success).toBe(false);
  });

  it("accepts NestJS-style array messages in error bodies", () => {
    expect(apiErrorBodySchema.parse({ message: ["a", "b"], code: "X" }).message).toBe("a; b");
  });
});

describe("api client error mapping", () => {
  const client = (res: TransportResponse | Error) => {
    const transport: Transport = { request: async () => (res instanceof Error ? Promise.reject(res) : res) };
    return createApiClient({ transport, getToken: () => "t" });
  };

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "notFound"],
    [409, "conflict"],
    [422, "validation"],
    [500, "server"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    const err = await client({ status, body: { message: "nope", code: "C" } }).getBatch("1").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe(kind);
  });

  it("carries row errors from 422 responses", async () => {
    const err = await client({ status: 422, body: { message: "bad", code: "VALIDATION_FAILED", errors: [{ row: 2, messages: ["x"] }] } })
      .getBatch("1")
      .catch((e) => e);
    expect(err.rowErrors).toEqual([{ row: 2, messages: ["x"] }]);
  });

  it("flags responses that break the contract", async () => {
    const err = await client({ status: 200, body: { ...batch, totalAmount: 12 } }).getBatch("1").catch((e) => e);
    expect(err.kind).toBe("invalidResponse");
  });

  it("calls onUnauthorized on 401", async () => {
    let called = false;
    const c = createApiClient({
      transport: { request: async () => ({ status: 401, body: { message: "x", code: "U" } }) },
      getToken: () => null,
      onUnauthorized: () => (called = true),
    });
    await c.getMe().catch(() => undefined);
    expect(called).toBe(true);
  });
});
