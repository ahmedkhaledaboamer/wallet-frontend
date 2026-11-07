/**
 * The app-wide API client. NEXT_PUBLIC_API_MODE picks the transport; nothing
 * else in the UI knows (or cares) whether it talks to the mock or the backend.
 */
import { env } from "@/lib/env";
import { clearSession, getToken } from "@/lib/session-store";
import { createApiClient, type ApiClient } from "./client";
import { createFetchTransport, type Transport } from "./transport";

let transport: Transport | undefined;
let client: ApiClient | undefined;

async function mockTransport(): Promise<Transport> {
  // Loaded on demand so the mock (and exceljs) never ship in a live-mode bundle path.
  const { createMockTransport } = await import("./mock/transport");
  return createMockTransport({ persist: true });
}

function lazyTransport(): Transport {
  if (env.apiMode === "live") return createFetchTransport(env.apiUrl);
  let pending: Promise<Transport> | undefined;
  return {
    async request(req) {
      pending ??= mockTransport();
      return (await pending).request(req);
    },
  };
}

export function api(): ApiClient {
  transport ??= lazyTransport();
  client ??= createApiClient({ transport, getToken, onUnauthorized: clearSession });
  return client;
}

export * from "./schemas";
export { ApiError, errorKind, isApiError, isRetryable, type ApiErrorKind } from "./errors";
export type { ApiClient, AuditListParams, BatchItemsParams, BatchListParams } from "./client";
