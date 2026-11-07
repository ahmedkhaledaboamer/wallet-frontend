/**
 * The transport is the only thing that differs between mock and live mode.
 * Both receive the same request shape and return raw status + body; parsing,
 * schema validation and error mapping happen once, in client.ts.
 */
export type HttpMethod = "GET" | "POST";
export type QueryValue = string | number | undefined | null;

export interface TransportRequest {
  method: HttpMethod;
  path: string; // e.g. "/batches/42/items"
  query?: Record<string, QueryValue>;
  body?: unknown | FormData;
  token?: string | null;
  responseType?: "json" | "blob";
  signal?: AbortSignal;
}

export interface TransportResponse {
  status: number;
  /** Parsed JSON (or a Blob when responseType = "blob"); undefined for empty bodies. */
  body: unknown;
  /** Suggested download filename from Content-Disposition, if any. */
  filename?: string;
}

export interface Transport {
  request(req: TransportRequest): Promise<TransportResponse>;
}

export function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export class NetworkError extends Error {
  constructor(cause: unknown) {
    super("Network request failed", { cause });
    this.name = "NetworkError";
  }
}

export function createFetchTransport(baseUrl: string): Transport {
  return {
    async request({ method, path, query, body, token, responseType = "json", signal }) {
      const headers: Record<string, string> = { Accept: responseType === "blob" ? "*/*" : "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      let payload: BodyInit | undefined;
      if (body instanceof FormData) {
        payload = body; // browser sets the multipart boundary
      } else if (body !== undefined) {
        headers["Content-Type"] = "application/json";
        payload = JSON.stringify(body);
      }

      let res: Response;
      try {
        res = await fetch(`${baseUrl}${path}${buildQuery(query)}`, { method, headers, body: payload, signal });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") throw e;
        throw new NetworkError(e);
      }

      if (res.ok && responseType === "blob") {
        const disposition = res.headers.get("Content-Disposition") ?? "";
        const filename = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1];
        return { status: res.status, body: await res.blob(), filename: filename ? decodeURIComponent(filename) : undefined };
      }

      const text = await res.text();
      let parsed: unknown = undefined;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { message: text };
        }
      }
      return { status: res.status, body: parsed };
    },
  };
}
