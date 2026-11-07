/**
 * Public runtime configuration. NEXT_PUBLIC_* values are inlined at build time,
 * so they must be referenced literally (no dynamic process.env[key]).
 */
export type ApiMode = "mock" | "live";

export const env = {
  apiUrl: (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/+$/, ""),
  apiMode: (process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock") as ApiMode,
  reownProjectId: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim() ?? "",
} as const;

export const isWalletConnectEnabled = env.reownProjectId.length > 0;
