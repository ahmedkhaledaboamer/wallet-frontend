/**
 * In-memory backend implementing the API CONTRACT. State transitions are
 * time-based (computed lazily from timestamps on every request), so processing
 * "advances" while the UI polls — and survives page reloads when persisted.
 */
import { keccak256, toHex } from "viem";
import { addDecimals, compareDecimals, sumDecimals, toUnits } from "@/lib/amount";
import type {
  AuditEntry,
  Batch,
  BatchItem,
  BatchStatus,
  Channel,
  DashboardStats,
  ItemStatus,
  Network,
  OnchainPayload,
  Page,
  User,
} from "../schemas";
import { BATCH_STATUSES, CHANNELS, ITEM_STATUSES } from "../schemas";
import type { TransportRequest, TransportResponse } from "../transport";
import {
  MOCK_CONFIG,
  MOCK_FAIL_MARKER,
  MOCK_PAYOUT_CONTRACT,
  MOCK_RECON_MARKER,
  MOCK_TOKENS,
  MOCK_TREASURY,
} from "./constants";
import {
  FAILURE_REASONS,
  MOCK_USERS,
  RECON_REASON,
  SEED_SPECS,
  centsToDecimal,
  prng,
  randomAddress,
  randomTxHash,
  referenceFor,
  userById,
  type Rng,
} from "./seed";
import { validateSheet, type ValidRow } from "./validate";
import { XLSX_MIME, buildWorkbook, parseWorkbook } from "./xlsx";

type Outcome = "succeeded" | "failed" | "requires_reconciliation";

interface ItemRec extends BatchItem {
  outcome: Outcome;
  outcomeReason?: string;
  startAt?: number;
  dueAt?: number;
}
interface BatchRec extends Batch {
  finalizeAt?: number;
}
export interface MockState {
  version: 2;
  seq: number;
  auditSeq: number;
  batches: BatchRec[];
  items: Record<string, ItemRec[]>;
  audit: AuditEntry[];
}

export interface MockTiming {
  /** Delay before the first MEXC item starts processing. */
  mexcStartDelayMs: number;
  /** Time each MEXC withdrawal spends in "processing". */
  mexcItemDurationMs: number;
  /** Upper bound for a whole MEXC batch, so big batches still finish quickly in the demo. */
  mexcBatchMaxMs: number;
  /** Time from POST /transaction until the "on-chain" confirmation. */
  chainConfirmMs: number;
}

export const DEFAULT_TIMING: MockTiming = {
  mexcStartDelayMs: 800,
  mexcItemDurationMs: 1200,
  mexcBatchMaxMs: 9000,
  chainConfirmMs: 6000,
};

const iso = (ms: number) => new Date(ms).toISOString();

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly errors?: { row: number; messages: string[] }[],
  ) {
    super(message);
  }
}

const explorerBase = (network: Network) => MOCK_CONFIG.networks.find((n) => n.network === network)!.explorerUrl;
const txUrl = (network: Network, hash: string) =>
  `${explorerBase(network)}/${network === "TRC20" ? "transaction" : "tx"}/${hash}`;

// ── Seeding ───────────────────────────────────────────────────────────────────

export function createSeedState(now: number = Date.now()): MockState {
  const rng = prng(20261107);
  const state: MockState = { version: 2, seq: 1000, auditSeq: 1, batches: [], items: {}, audit: [] };
  const maker = userById("u-maker");
  const checker = userById("u-checker");
  const executor = userById("u-executor");
  const day = 86_400_000;

  for (const spec of SEED_SPECS) {
    const no = ++state.seq;
    const id = `PO-${no}`;
    const createdAt = now - spec.daysAgo * day - rng.int(1, 6) * 3_600_000;
    const items: ItemRec[] = [];
    for (let i = 0; i < spec.items; i++) {
      items.push({
        id: `${id}-${i + 1}`,
        reference: referenceFor(no, i),
        address: randomAddress(rng, spec.network),
        amount: centsToDecimal(rng.int(2_500, 480_000)),
        status: "pending",
        outcome: "succeeded",
      });
    }
    // Pick which items fail / need reconciliation.
    let f = spec.failures ?? 0;
    let r = spec.reconciliations ?? 0;
    for (let i = items.length - 1; i >= 0 && (f > 0 || r > 0); i -= 3) {
      if (f > 0) {
        items[i].outcome = "failed";
        items[i].outcomeReason = rng.pick(FAILURE_REASONS);
        f--;
      } else if (r > 0) {
        items[i].outcome = "requires_reconciliation";
        items[i].outcomeReason = RECON_REASON;
        r--;
      }
    }
    if (spec.status === "failed") items.forEach((it) => ((it.outcome = "failed"), (it.outcomeReason = FAILURE_REASONS[1])));

    const batch: BatchRec = {
      id,
      channel: spec.channel,
      status: "draft",
      asset: "USDT",
      network: spec.network,
      totalAmount: sumDecimals(items.map((x) => x.amount)),
      itemCount: items.length,
      paidCount: 0,
      failedCount: 0,
      reconciliationCount: 0,
      createdBy: maker,
      createdAt: iso(createdAt),
    };
    state.batches.push(batch);
    state.items[id] = items;
    pushAudit(state, id, "batch.created", maker, createdAt, {
      fileName: `withdrawals-${no}.xlsx`,
      rowCount: items.length,
      totalAmount: batch.totalAmount,
      channel: spec.channel,
    });

    if (spec.status === "draft") continue;
    const approvedAt = createdAt + rng.int(20, 180) * 60_000;
    if (spec.status === "rejected") {
      Object.assign(batch, { status: "rejected", rejectionReason: "Two references don't match the payroll export — please re-check and re-upload." });
      pushAudit(state, id, "batch.rejected", checker, approvedAt, { reason: batch.rejectionReason });
      continue;
    }
    Object.assign(batch, { status: "approved", approvedBy: checker, approvedAt: iso(approvedAt) });
    pushAudit(state, id, "batch.approved", checker, approvedAt, {});
    if (spec.status === "approved") continue;

    const executedAt = approvedAt + rng.int(30, 240) * 60_000;
    const completedAt = executedAt + rng.int(1, 12) * 60_000;
    Object.assign(batch, { executedBy: executor, executedAt: iso(executedAt), completedAt: iso(completedAt) });
    const txHash = randomTxHash(rng);
    if (spec.channel === "trust_wallet") {
      Object.assign(batch, { txHash, explorerUrl: txUrl(spec.network, txHash) });
      pushAudit(state, id, "batch.transaction_submitted", executor, executedAt, { txHash, from: MOCK_TREASURY });
    } else {
      pushAudit(state, id, "batch.execution_started", executor, executedAt, { provider: "MEXC" });
    }
    for (const it of items) settleItem(state, batch, it, completedAt, rng, txHash, false);
    finalizeBatch(state, batch, completedAt);
  }
  return state;
}

function pushAudit(state: MockState, batchId: string, action: string, actor: User | undefined, at: number, context: Record<string, unknown>) {
  state.audit.push({ id: `AU-${state.auditSeq++}`, batchId, action, actor, context, createdAt: iso(at) });
}

function settleItem(state: MockState, batch: BatchRec, it: ItemRec, at: number, rng: Rng, chainTx?: string, audit = true) {
  it.status = it.outcome as ItemStatus;
  it.processedAt = iso(at);
  if (it.outcome === "succeeded") {
    const hash = chainTx && batch.channel === "trust_wallet" ? chainTx : randomTxHash(rng);
    it.providerReference = batch.channel === "mexc" ? `MX-WD-${rng.int(10_000_000, 99_999_999)}` : hash;
    it.explorerUrl = txUrl(batch.network, batch.network === "TRC20" ? hash.slice(2) : hash);
    it.failureReason = undefined;
  } else {
    it.failureReason = it.outcomeReason;
    if (batch.channel === "mexc" && it.outcome === "requires_reconciliation") it.providerReference = `MX-WD-${rng.int(10_000_000, 99_999_999)}`;
    if (audit) {
      pushAudit(state, batch.id, it.outcome === "failed" ? "item.failed" : "item.requires_reconciliation", undefined, at, {
        itemId: it.id,
        reference: it.reference,
        reason: it.outcomeReason,
      });
    }
  }
}

function recount(batch: BatchRec, items: ItemRec[]) {
  batch.paidCount = items.filter((x) => x.status === "succeeded").length;
  batch.failedCount = items.filter((x) => x.status === "failed").length;
  batch.reconciliationCount = items.filter((x) => x.status === "requires_reconciliation").length;
}

function finalizeBatch(state: MockState, batch: BatchRec, at: number) {
  const items = state.items[batch.id];
  recount(batch, items);
  const status: BatchStatus =
    batch.paidCount === batch.itemCount ? "completed" : batch.paidCount === 0 && batch.reconciliationCount === 0 ? "failed" : "completed_with_issues";
  batch.status = status;
  batch.completedAt = iso(at);
  batch.finalizeAt = undefined;
  const paid = sumDecimals(items.filter((x) => x.status === "succeeded").map((x) => x.amount));
  pushAudit(state, batch.id, `batch.${status}`, undefined, at, {
    paidCount: batch.paidCount,
    failedCount: batch.failedCount,
    reconciliationCount: batch.reconciliationCount,
    paidAmount: paid,
  });
}

// ── Server ────────────────────────────────────────────────────────────────────

export class MockServer {
  private rng: Rng;

  constructor(
    public state: MockState,
    private readonly timing: MockTiming = DEFAULT_TIMING,
    private readonly clock: () => number = Date.now,
  ) {
    this.rng = prng(state.seq * 7919 + state.auditSeq);
  }

  /** Applies every time-based transition that is due. */
  advance(now = this.clock()) {
    for (const batch of this.state.batches) {
      if (batch.status !== "processing") continue;
      const items = this.state.items[batch.id];
      if (batch.channel === "trust_wallet") {
        if (batch.finalizeAt !== undefined && now >= batch.finalizeAt) {
          for (const it of items) {
            it.outcome = "succeeded";
            settleItem(this.state, batch, it, batch.finalizeAt, this.rng, batch.txHash);
          }
          finalizeBatch(this.state, batch, batch.finalizeAt);
        }
        continue;
      }
      for (const it of items) {
        if (it.status === "pending" && it.startAt !== undefined && now >= it.startAt) it.status = "processing";
        if (it.status === "processing" && it.dueAt !== undefined && now >= it.dueAt) settleItem(this.state, batch, it, it.dueAt, this.rng);
      }
      recount(batch, items);
      if (items.every((x) => x.status !== "pending" && x.status !== "processing")) {
        finalizeBatch(this.state, batch, Math.max(...items.map((x) => x.dueAt ?? now)));
      }
    }
  }

  async handle(req: TransportRequest): Promise<TransportResponse> {
    try {
      this.advance();
      return await this.route(req);
    } catch (e) {
      if (e instanceof HttpError) {
        return { status: e.status, body: { message: e.message, code: e.code, ...(e.errors ? { errors: e.errors } : {}) } };
      }
      console.error("[mock] unhandled", e);
      return { status: 500, body: { message: "Mock server error", code: "INTERNAL" } };
    }
  }

  private auth(req: TransportRequest, ...roles: User["role"][]): User {
    const u = MOCK_USERS.find((x) => x.token === req.token);
    if (!u) throw new HttpError(401, "UNAUTHORIZED", "Missing or invalid token.");
    if (roles.length && !roles.includes(u.role)) {
      throw new HttpError(403, "FORBIDDEN_ROLE", `This action requires the ${roles.join(" or ")} role.`);
    }
    return { id: u.id, name: u.name, role: u.role };
  }

  private batch(id: string): BatchRec {
    const b = this.state.batches.find((x) => x.id === id);
    if (!b) throw new HttpError(404, "NOT_FOUND", `Batch ${id} not found.`);
    return b;
  }

  private requireStatus(b: BatchRec, ...allowed: BatchStatus[]) {
    if (!allowed.includes(b.status)) {
      throw new HttpError(409, "ILLEGAL_STATE", `Batch ${b.id} is ${b.status}; expected ${allowed.join(" or ")}.`);
    }
  }

  private async route(req: TransportRequest): Promise<TransportResponse> {
    const { method, path } = req;
    const q = req.query ?? {};
    const seg = path.split("/").filter(Boolean).map(decodeURIComponent);
    const ok = (body: unknown, status = 200): TransportResponse => ({ status, body: structuredClone(body) });

    // Public
    if (method === "GET" && path === "/config") return ok(MOCK_CONFIG);
    if (method === "GET" && path === "/demo/users") return ok(MOCK_USERS);

    if (method === "GET" && path === "/me") return ok(this.auth(req));
    if (method === "GET" && path === "/dashboard/stats") {
      this.auth(req);
      return ok(this.stats());
    }
    if (method === "GET" && path === "/templates/withdrawals.xlsx") {
      this.auth(req);
      const buf = await buildWorkbook([
        { reference: "WD-2026-0001", address: "TXYZ1234abcdEFGH5678ijkLMNOpqrsTUV", amount: "125.50", asset: "USDT", network: "TRC20", memo: "" },
      ]);
      return { status: 200, body: new Blob([buf], { type: XLSX_MIME }), filename: "withdrawals-template.xlsx" };
    }

    if (seg[0] === "batches") {
      if (seg.length === 1 && method === "GET") return ok(this.listBatches(q));
      if (seg.length === 2 && seg[1] === "validate" && method === "POST") {
        this.auth(req, "maker");
        const { outcome } = await this.readUpload(req);
        const result: Partial<typeof outcome> = { ...outcome };
        delete result.rows;
        return ok(result);
      }
      if (seg.length === 1 && method === "POST") return ok(await this.createBatch(req), 201);

      const id = seg[1];
      const action = seg[2];
      if (seg.length === 2 && method === "GET") {
        this.auth(req);
        return ok(publicBatch(this.batch(id)));
      }
      if (action === "items" && method === "GET") {
        this.auth(req);
        return ok(this.listItems(id, q));
      }
      if (action === "audit" && method === "GET") {
        this.auth(req);
        this.batch(id);
        return ok(this.state.audit.filter((a) => a.batchId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      }
      if (action === "approve" && method === "POST") return ok(this.approve(req, id));
      if (action === "reject" && method === "POST") return ok(this.reject(req, id));
      if (action === "execute" && method === "POST") return ok(this.execute(req, id), 202);
      if (action === "onchain-payload" && method === "GET") return ok(this.onchainPayload(req, id));
      if (action === "transaction" && method === "POST") return ok(this.submitTx(req, id), 202);
    }

    if (method === "GET" && path === "/audit") {
      this.auth(req);
      let list = [...this.state.audit];
      if (q.batchId) list = list.filter((a) => a.batchId === String(q.batchId));
      if (q.action) list = list.filter((a) => a.action === String(q.action));
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      return ok(paginate(list, q, 50));
    }

    throw new HttpError(404, "NOT_FOUND", `No route for ${method} ${path}`);
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  private stats(): DashboardStats {
    const succeeded = (b: BatchRec) => this.state.items[b.id].filter((x) => x.status === "succeeded").map((x) => x.amount);
    const byChannel = CHANNELS.map((channel) => {
      const batches = this.state.batches.filter((b) => b.channel === channel);
      return { channel, totalPaid: sumDecimals(batches.flatMap(succeeded)), batchCount: batches.length };
    });
    return {
      totalPaid: byChannel.reduce((acc, c) => addDecimals(acc, c.totalPaid), "0"),
      pendingApprovalCount: this.state.batches.filter((b) => b.status === "draft").length,
      processingCount: this.state.batches.filter((b) => b.status === "processing").length,
      needsReconciliationCount: Object.values(this.state.items).flat().filter((x) => x.status === "requires_reconciliation").length,
      byChannel,
    };
  }

  private listBatches(q: NonNullable<TransportRequest["query"]>): Page<Batch> {
    let list = [...this.state.batches];
    if (q.status && (BATCH_STATUSES as readonly string[]).includes(String(q.status))) list = list.filter((b) => b.status === q.status);
    if (q.channel && (CHANNELS as readonly string[]).includes(String(q.channel))) list = list.filter((b) => b.channel === q.channel);
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginate(list.map(publicBatch), q, 20);
  }

  private listItems(id: string, q: NonNullable<TransportRequest["query"]>): Page<BatchItem> {
    let list = [...this.items(id)];
    if (q.status && (ITEM_STATUSES as readonly string[]).includes(String(q.status))) list = list.filter((x) => x.status === q.status);
    const search = String(q.search ?? "").trim().toLowerCase();
    if (search) {
      list = list.filter(
        (x) =>
          x.reference.toLowerCase().includes(search) ||
          x.address.toLowerCase().includes(search) ||
          (x.providerReference ?? "").toLowerCase().includes(search),
      );
    }
    return paginate(list.map(publicItem), q, 50);
  }

  private items(id: string): ItemRec[] {
    this.batch(id);
    return this.state.items[id];
  }

  private async readUpload(req: TransportRequest) {
    const form = req.body;
    if (!(form instanceof FormData)) throw new HttpError(422, "VALIDATION_FAILED", "Expected multipart form data.");
    const file = form.get("file");
    const channel = form.get("channel");
    if (!(CHANNELS as readonly unknown[]).includes(channel)) {
      throw new HttpError(422, "VALIDATION_FAILED", "channel must be mexc or trust_wallet.");
    }
    if (!(file instanceof Blob)) throw new HttpError(422, "VALIDATION_FAILED", "file is required.");
    const name = file instanceof File ? file.name : "upload.xlsx";
    const sheet = /\.xlsx$/i.test(name) ? await parseWorkbook(await file.arrayBuffer()) : null;
    const outcome = validateSheet(sheet, channel as Channel, MOCK_CONFIG);
    return { outcome, channel: channel as Channel, name };
  }

  private async createBatch(req: TransportRequest): Promise<Batch> {
    const user = this.auth(req, "maker");
    const { outcome, channel, name } = await this.readUpload(req);
    if (!outcome.valid || !outcome.network || !outcome.asset) {
      throw new HttpError(422, "VALIDATION_FAILED", "The withdrawal list has validation errors.", outcome.errors);
    }
    const now = this.clock();
    const no = ++this.state.seq;
    const id = `PO-${no}`;
    const batch: BatchRec = {
      id,
      channel,
      status: "draft",
      asset: outcome.asset,
      network: outcome.network,
      totalAmount: outcome.totalAmount,
      itemCount: outcome.rows.length,
      paidCount: 0,
      failedCount: 0,
      reconciliationCount: 0,
      createdBy: user,
      createdAt: iso(now),
    };
    this.state.batches.push(batch);
    this.state.items[id] = outcome.rows.map((r: ValidRow, i) => itemFromRow(id, i, r, channel));
    pushAudit(this.state, id, "batch.created", user, now, {
      fileName: name,
      rowCount: batch.itemCount,
      totalAmount: batch.totalAmount,
      channel,
    });
    return publicBatch(batch);
  }

  private approve(req: TransportRequest, id: string): Batch {
    const user = this.auth(req, "checker");
    const b = this.batch(id);
    this.requireStatus(b, "draft");
    if (b.createdBy.id === user.id) throw new HttpError(422, "FOUR_EYES", "The maker of a batch cannot approve it.");
    const now = this.clock();
    Object.assign(b, { status: "approved", approvedBy: user, approvedAt: iso(now) });
    pushAudit(this.state, id, "batch.approved", user, now, {});
    return publicBatch(b);
  }

  private reject(req: TransportRequest, id: string): Batch {
    const user = this.auth(req, "checker");
    const b = this.batch(id);
    this.requireStatus(b, "draft");
    const reason = String((req.body as { reason?: unknown } | undefined)?.reason ?? "").trim();
    if (reason.length < 5) throw new HttpError(422, "VALIDATION_FAILED", "A rejection reason of at least 5 characters is required.");
    const now = this.clock();
    Object.assign(b, { status: "rejected", rejectionReason: reason });
    pushAudit(this.state, id, "batch.rejected", user, now, { reason });
    return publicBatch(b);
  }

  private execute(req: TransportRequest, id: string): Batch {
    const user = this.auth(req, "executor");
    const b = this.batch(id);
    if (b.channel !== "mexc") throw new HttpError(422, "CHANNEL_MISMATCH", "Trust Wallet batches are paid by signing in the wallet.");
    this.requireStatus(b, "approved");
    const now = this.clock();
    const items = this.state.items[id];
    const step = Math.max(150, Math.min(900, (this.timing.mexcBatchMaxMs - this.timing.mexcItemDurationMs) / Math.max(1, items.length)));
    items.forEach((it, i) => {
      it.status = "pending";
      it.startAt = now + this.timing.mexcStartDelayMs + i * step;
      it.dueAt = it.startAt + this.timing.mexcItemDurationMs;
    });
    Object.assign(b, { status: "processing", executedBy: user, executedAt: iso(now) });
    pushAudit(this.state, id, "batch.execution_started", user, now, { provider: "MEXC", itemCount: b.itemCount, totalAmount: b.totalAmount });
    return publicBatch(b);
  }

  private onchainPayload(req: TransportRequest, id: string): OnchainPayload {
    this.auth(req, "executor");
    const b = this.batch(id);
    if (b.channel !== "trust_wallet") throw new HttpError(422, "CHANNEL_MISMATCH", "On-chain payloads exist only for Trust Wallet batches.");
    this.requireStatus(b, "approved");
    if (b.network === "TRC20") throw new HttpError(422, "UNSUPPORTED_NETWORK", "TRC20 can't be paid from Trust Wallet.");
    const net = MOCK_CONFIG.networks.find((n) => n.network === b.network)!;
    const token = MOCK_TOKENS[b.network];
    const items = this.state.items[id];
    return {
      chainId: net.chainId!,
      contract: MOCK_PAYOUT_CONTRACT,
      token: token.address,
      tokenDecimals: token.decimals,
      treasury: MOCK_TREASURY,
      batchRef: keccak256(toHex(b.id)),
      recipients: items.map((x) => x.address as `0x${string}`),
      // Base units, exactly like the real backend: decimal × 10^tokenDecimals.
      amounts: items.map((x) => toUnits(x.amount, token.decimals).toString()),
      total: toUnits(b.totalAmount, token.decimals).toString(),
    };
  }

  private submitTx(req: TransportRequest, id: string): Batch {
    const user = this.auth(req, "executor");
    const b = this.batch(id);
    if (b.channel !== "trust_wallet") throw new HttpError(422, "CHANNEL_MISMATCH", "Only Trust Wallet batches accept a transaction hash.");
    this.requireStatus(b, "approved");
    const txHash = String((req.body as { txHash?: unknown } | undefined)?.txHash ?? "");
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new HttpError(422, "VALIDATION_FAILED", "txHash must be a 0x-prefixed 32-byte hash.");
    const now = this.clock();
    for (const it of this.state.items[id]) it.status = "processing";
    Object.assign(b, {
      status: "processing",
      executedBy: user,
      executedAt: iso(now),
      txHash,
      explorerUrl: txUrl(b.network, txHash),
      finalizeAt: now + this.timing.chainConfirmMs,
    });
    pushAudit(this.state, id, "batch.transaction_submitted", user, now, { txHash, from: MOCK_TREASURY });
    return publicBatch(b);
  }
}

function itemFromRow(batchId: string, i: number, r: ValidRow, channel: Channel): ItemRec {
  const ref = r.reference.toUpperCase();
  let outcome: Outcome = "succeeded";
  let outcomeReason: string | undefined;
  if (channel === "mexc" && ref.endsWith(MOCK_FAIL_MARKER)) {
    outcome = "failed";
    outcomeReason = FAILURE_REASONS[0];
  } else if (channel === "mexc" && ref.endsWith(MOCK_RECON_MARKER)) {
    outcome = "requires_reconciliation";
    outcomeReason = RECON_REASON;
  }
  return {
    id: `${batchId}-${i + 1}`,
    reference: r.reference,
    address: r.address,
    amount: r.amount,
    memo: r.memo,
    status: "pending",
    outcome,
    outcomeReason,
  };
}

function publicBatch(b: BatchRec): Batch {
  const out: BatchRec = { ...b };
  delete out.finalizeAt;
  return out;
}

function publicItem(x: ItemRec): BatchItem {
  const out: Partial<ItemRec> = { ...x };
  delete out.outcome;
  delete out.outcomeReason;
  delete out.startAt;
  delete out.dueAt;
  return out as BatchItem;
}

function paginate<T>(list: T[], q: NonNullable<TransportRequest["query"]>, defaultSize: number): Page<T> {
  const pageSize = Math.min(200, Math.max(1, Number(q.pageSize) || defaultSize));
  const page = Math.max(1, Number(q.page) || 1);
  return { data: list.slice((page - 1) * pageSize, page * pageSize), meta: { page, pageSize, total: list.length } };
}

/** Exposed for tests: confirms the seeded totals are internally consistent. */
export function batchTotalMatchesItems(state: MockState, id: string): boolean {
  const b = state.batches.find((x) => x.id === id);
  return !!b && compareDecimals(b.totalAmount, sumDecimals(state.items[id].map((x) => x.amount))) === 0;
}
