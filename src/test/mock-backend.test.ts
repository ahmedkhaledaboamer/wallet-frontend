import { describe, expect, it } from "vitest";
import { createApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { buildWorkbook, type TemplateRow } from "@/lib/api/mock/xlsx";
import { createMockTransport } from "@/lib/api/mock/transport";
import { batchTotalMatchesItems } from "@/lib/api/mock/server";

const TRON = "TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeA";

function setup() {
  let now = Date.parse("2026-11-07T10:00:00Z");
  const transport = createMockTransport({ latency: [0, 0], clock: () => now });
  let token = "demo-token-maker";
  const api = createApiClient({ transport, getToken: () => token });
  return {
    api,
    as: (role: "maker" | "checker" | "executor") => (token = `demo-token-${role}`),
    advance: (ms: number) => (now += ms),
    state: transport.server.state,
  };
}

async function xlsx(rows: TemplateRow[], name = "list.xlsx") {
  return new File([await buildWorkbook(rows)], name);
}

describe("mock backend implements the contract", () => {
  it("seeds consistent data", async () => {
    const { api, state } = setup();
    const page = await api.listBatches({ pageSize: 50 });
    expect(page.meta.total).toBeGreaterThan(5);
    for (const b of page.data) expect(batchTotalMatchesItems(state, b.id)).toBe(true);
  });

  it("validates a bad file row-by-row", async () => {
    const { api } = setup();
    const res = await api.validateBatch(
      await xlsx([
        { reference: "A", address: TRON, amount: "10", asset: "USDT", network: "TRC20" },
        { reference: "A", address: "nope", amount: "abc", asset: "USDT", network: "TRC20" },
      ]),
      "mexc",
    );
    expect(res.valid).toBe(false);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0].row).toBe(3);
    expect(res.errors[0].messages.join(" ")).toMatch(/Duplicate reference.*not a valid TRC20.*not a positive number/);
  });

  it("rejects TRC20 for Trust Wallet and non-xlsx files", async () => {
    const { api } = setup();
    const trc = await api.validateBatch(await xlsx([{ reference: "A", address: TRON, amount: "1", asset: "USDT", network: "TRC20" }]), "trust_wallet");
    expect(trc.errors[0].messages[0]).toMatch(/BEP20 or ERC20 only/);
    const junk = await api.validateBatch(new File(["hello"], "list.csv"), "mexc");
    expect(junk.errors[0].row).toBe(0);
  });

  it("enforces roles (403) and legal transitions (409)", async () => {
    const { api, as } = setup();
    const file = await xlsx([{ reference: "A", address: TRON, amount: "10", asset: "USDT", network: "TRC20" }]);
    const batch = await api.createBatch(file, "mexc");
    expect(batch.status).toBe("draft");

    const forbidden = await api.approveBatch(batch.id).catch((e: ApiError) => e);
    expect((forbidden as ApiError).kind).toBe("forbidden");

    as("checker");
    expect((await api.approveBatch(batch.id)).status).toBe("approved");
    const again = await api.approveBatch(batch.id).catch((e: ApiError) => e);
    expect((again as ApiError).kind).toBe("conflict");
  });

  it("processes a MEXC batch over time to a final status", async () => {
    const { api, as, advance } = setup();
    const file = await xlsx([
      { reference: "A", address: TRON, amount: "10", asset: "USDT", network: "TRC20" },
      { reference: "B-FAIL", address: TRON, amount: "5.5", asset: "USDT", network: "TRC20" },
    ]);
    const { id } = await api.createBatch(file, "mexc");
    as("checker");
    await api.approveBatch(id);
    as("executor");
    expect((await api.executeBatch(id)).status).toBe("processing");
    advance(1000);
    expect((await api.getBatch(id)).status).toBe("processing");
    advance(20_000);
    const done = await api.getBatch(id);
    expect(done.status).toBe("completed_with_issues");
    expect(done.paidCount).toBe(1);
    expect(done.failedCount).toBe(1);
    const items = await api.listBatchItems(id, { status: "failed" });
    expect(items.data[0].failureReason).toBeTruthy();
    const audit = await api.getBatchAudit(id);
    expect(audit.map((a) => a.action)).toContain("batch.completed_with_issues");
  });

  it("serves an on-chain payload and settles after a submitted tx", async () => {
    const { api, as, advance } = setup();
    const file = await xlsx([{ reference: "T1", address: "0x1111111111111111111111111111111111111111", amount: "12.5", asset: "USDT", network: "BEP20" }]);
    const { id } = await api.createBatch(file, "trust_wallet");
    as("checker");
    await api.approveBatch(id);
    as("executor");
    const payload = await api.getOnchainPayload(id);
    expect(payload.chainId).toBe(97);
    expect(payload.tokenDecimals).toBe(18);
    expect(payload.total).toBe("12500000000000000000"); // base units
    expect(payload.amounts).toEqual(["12500000000000000000"]);
    const execute = await api.executeBatch(id).catch((e: ApiError) => e);
    expect((execute as ApiError).kind).toBe("validation");
    await api.submitTransaction(id, "0x" + "a".repeat(64));
    advance(10_000);
    const b = await api.getBatch(id);
    expect(b.status).toBe("completed");
    expect(b.explorerUrl).toContain("testnet.bscscan.com/tx/");
  });

  it("returns 401 without a token", async () => {
    const transport = createMockTransport({ latency: [0, 0] });
    const api = createApiClient({ transport, getToken: () => null });
    expect(((await api.getMe().catch((e) => e)) as ApiError).kind).toBe("unauthorized");
    expect((await api.getConfig()).environment).toBe("testnet");
  });
});
