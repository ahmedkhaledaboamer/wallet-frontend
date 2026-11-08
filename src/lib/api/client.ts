/**
 * Typed API client. One method per contract endpoint; every response is
 * validated with zod, every failure is normalized into an ApiError.
 */
import type { z } from "zod";
import { ApiError } from "./errors";
import {
  apiErrorBodySchema,
  auditEntrySchema,
  batchItemSchema,
  batchSchema,
  configSchema,
  dashboardStatsSchema,
  demoUsersSchema,
  onchainPayloadSchema,
  pageSchema,
  userSchema,
  validationResultSchema,
  type BatchStatus,
  type Channel,
  type ItemStatus,
} from "./schemas";
import { NetworkError, type Transport, type TransportRequest } from "./transport";

export interface BatchListParams {
  status?: BatchStatus;
  channel?: Channel;
  page?: number;
  pageSize?: number;
}
export interface BatchItemsParams {
  status?: ItemStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}
export interface AuditListParams {
  batchId?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}

export interface ApiClientOptions {
  transport: Transport;
  getToken: () => string | null;
  /** Called on any 401 so the session can be cleared. */
  onUnauthorized?: () => void;
}

const batchPage = pageSchema(batchSchema);
const itemPage = pageSchema(batchItemSchema);
const auditPage = pageSchema(auditEntrySchema);

export function createApiClient({ transport, getToken, onUnauthorized }: ApiClientOptions) {
  async function send(req: Omit<TransportRequest, "token">) {
    let res;
    try {
      res = await transport.request({ ...req, token: getToken() });
    } catch (e) {
      if (e instanceof NetworkError) throw new ApiError({ status: 0, kind: "network", code: "NETWORK", message: e.message });
      throw e;
    }
    if (res.status >= 200 && res.status < 300) return res;

    const parsed = apiErrorBodySchema.safeParse(res.body);
    const err = new ApiError({
      status: res.status,
      message: parsed.success ? parsed.data.message : `Request failed with status ${res.status}`,
      code: parsed.success ? parsed.data.code : undefined,
      rowErrors: parsed.success ? parsed.data.errors : undefined,
    });
    if (res.status === 401) onUnauthorized?.();
    throw err;
  }

  async function json<S extends z.ZodType>(schema: S, req: Omit<TransportRequest, "token">): Promise<z.output<S>> {
    const res = await send(req);
    const result = schema.safeParse(res.body);
    if (!result.success) {
      if (process.env.NODE_ENV !== "production") {
        console.error(`[api] ${req.method} ${req.path} response does not match contract`, result.error.issues, res.body);
      }
      throw new ApiError({
        status: res.status,
        kind: "invalidResponse",
        code: "INVALID_RESPONSE",
        message: `Unexpected response from ${req.method} ${req.path}`,
      });
    }
    return result.data;
  }

  const upload = (file: File, channel: Channel) => {
    const form = new FormData();
    form.append("file", file);
    form.append("channel", channel);
    return form;
  };

  return {
    getConfig: () => json(configSchema, { method: "GET", path: "/config" }),
    getDemoUsers: () => json(demoUsersSchema, { method: "GET", path: "/demo/users" }),
    getMe: () => json(userSchema, { method: "GET", path: "/me" }),
    getDashboardStats: () => json(dashboardStatsSchema, { method: "GET", path: "/dashboard/stats" }),

    async downloadTemplate(): Promise<{ blob: Blob; filename: string }> {
      const res = await send({ method: "GET", path: "/templates/withdrawals.xlsx", responseType: "blob" });
      if (!(res.body instanceof Blob)) {
        throw new ApiError({ status: res.status, kind: "invalidResponse", message: "Template is not a file" });
      }
      return { blob: res.body, filename: res.filename ?? "withdrawals-template.xlsx" };
    },

    /** Excel export of a batch's withdrawals (same status/search filters as the table). */
    async downloadBatchItems(id: string, p: Pick<BatchItemsParams, "status" | "search"> = {}): Promise<{ blob: Blob; filename: string }> {
      const res = await send({
        method: "GET",
        path: `/batches/${encodeURIComponent(id)}/items.xlsx`,
        query: { status: p.status, search: p.search },
        responseType: "blob",
      });
      if (!(res.body instanceof Blob)) {
        throw new ApiError({ status: res.status, kind: "invalidResponse", message: "Export is not a file" });
      }
      return { blob: res.body, filename: res.filename ?? `batch-${id.slice(0, 8)}-withdrawals.xlsx` };
    },

    validateBatch: (file: File, channel: Channel, signal?: AbortSignal) =>
      json(validationResultSchema, { method: "POST", path: "/batches/validate", body: upload(file, channel), signal }),
    createBatch: (file: File, channel: Channel) =>
      json(batchSchema, { method: "POST", path: "/batches", body: upload(file, channel) }),

    listBatches: (p: BatchListParams = {}) =>
      json(batchPage, {
        method: "GET",
        path: "/batches",
        query: { status: p.status, channel: p.channel, page: p.page ?? 1, pageSize: p.pageSize ?? 20 },
      }),
    getBatch: (id: string) => json(batchSchema, { method: "GET", path: `/batches/${encodeURIComponent(id)}` }),
    listBatchItems: (id: string, p: BatchItemsParams = {}) =>
      json(itemPage, {
        method: "GET",
        path: `/batches/${encodeURIComponent(id)}/items`,
        query: { status: p.status, search: p.search, page: p.page ?? 1, pageSize: p.pageSize ?? 50 },
      }),
    getBatchAudit: (id: string) =>
      json(auditEntrySchema.array(), { method: "GET", path: `/batches/${encodeURIComponent(id)}/audit` }),

    approveBatch: (id: string) => json(batchSchema, { method: "POST", path: `/batches/${encodeURIComponent(id)}/approve` }),
    rejectBatch: (id: string, reason: string) =>
      json(batchSchema, { method: "POST", path: `/batches/${encodeURIComponent(id)}/reject`, body: { reason } }),
    executeBatch: (id: string) => json(batchSchema, { method: "POST", path: `/batches/${encodeURIComponent(id)}/execute` }),
    getOnchainPayload: (id: string) =>
      json(onchainPayloadSchema, { method: "GET", path: `/batches/${encodeURIComponent(id)}/onchain-payload` }),
    submitTransaction: (id: string, txHash: string) =>
      json(batchSchema, { method: "POST", path: `/batches/${encodeURIComponent(id)}/transaction`, body: { txHash } }),

    listAudit: (p: AuditListParams = {}) =>
      json(auditPage, {
        method: "GET",
        path: "/audit",
        query: { batchId: p.batchId, action: p.action, page: p.page ?? 1, pageSize: p.pageSize ?? 50 },
      }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
