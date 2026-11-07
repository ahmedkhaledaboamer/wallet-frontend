import type { AppConfig, Network } from "@/lib/api/schemas";

/** Builds explorer links from GET /config's per-network explorerUrl base. */
export function explorerBase(config: AppConfig | undefined, network: Network): string | undefined {
  return config?.networks.find((n) => n.network === network)?.explorerUrl.replace(/\/+$/, "");
}

export function addressUrl(config: AppConfig | undefined, network: Network, address: string): string | undefined {
  const base = explorerBase(config, network);
  return base ? `${base}/address/${address}` : undefined;
}

export function txUrl(config: AppConfig | undefined, network: Network, hash: string): string | undefined {
  const base = explorerBase(config, network);
  if (!base) return undefined;
  return network === "TRC20" ? `${base}/transaction/${hash.replace(/^0x/, "")}` : `${base}/tx/${hash}`;
}

/** "0x8ba1f109…6dba72" — keeps enough characters on both ends to eyeball. */
export function truncateMiddle(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** Only http(s) links from the API are rendered as hrefs. */
export function safeHref(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}
