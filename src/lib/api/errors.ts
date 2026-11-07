import type { RowError } from "./schemas";

export type ApiErrorKind =
  | "unauthorized" // 401
  | "forbidden" // 403 — wrong role
  | "notFound" // 404
  | "conflict" // 409 — illegal state transition
  | "validation" // 422 — validation / policy
  | "server" // 5xx
  | "network" // fetch failed / offline
  | "invalidResponse" // response didn't match the contract schema
  | "unknown";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly kind: ApiErrorKind;
  readonly rowErrors: RowError[];

  constructor(opts: { status: number; message: string; code?: string; rowErrors?: RowError[]; kind?: ApiErrorKind }) {
    super(opts.message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code ?? "UNKNOWN";
    this.rowErrors = opts.rowErrors ?? [];
    this.kind = opts.kind ?? kindFromStatus(opts.status);
  }
}

export function kindFromStatus(status: number): ApiErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "validation";
  if (status >= 500) return "server";
  return "unknown";
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/**
 * Translation key (under `errors.*`) for any thrown value. The UI shows the
 * translated sentence, and for validation errors also the server's own message
 * (it carries the specific policy that was violated).
 */
export function errorKind(e: unknown): ApiErrorKind {
  return isApiError(e) ? e.kind : "unknown";
}

/** Whether retrying the same request might succeed. */
export function isRetryable(e: unknown): boolean {
  const k = errorKind(e);
  return k === "network" || k === "server" || k === "unknown" || k === "invalidResponse";
}
