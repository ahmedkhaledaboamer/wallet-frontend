/** Deterministic demo data so screenshots and tests are stable. */
import { getAddress } from "viem";
import type { Channel, Network, User } from "../schemas";

export function prng(seed: number) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    hex: (len: number) => Array.from({ length: len }, () => "0123456789abcdef"[Math.floor(next() * 16)]).join(""),
  };
}
export type Rng = ReturnType<typeof prng>;

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function randomAddress(rng: Rng, network: Network): string {
  if (network === "TRC20") return "T" + Array.from({ length: 33 }, () => B58[Math.floor(rng.next() * 58)]).join("");
  return getAddress(`0x${rng.hex(40)}`);
}

export function randomTxHash(rng: Rng): `0x${string}` {
  return `0x${rng.hex(64)}`;
}

/** Amount in cents → decimal string, without floating point. */
export function centsToDecimal(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export const MOCK_USERS: (User & { token: string })[] = [
  { id: "u-maker", name: "Sara Haddad", role: "maker", token: "demo-token-maker" },
  { id: "u-checker", name: "Omar Khalil", role: "checker", token: "demo-token-checker" },
  { id: "u-executor", name: "Lina Mansour", role: "executor", token: "demo-token-executor" },
];

export const userById = (id: string): User => {
  const u = MOCK_USERS.find((x) => x.id === id);
  if (!u) throw new Error(`unknown mock user ${id}`);
  return { id: u.id, name: u.name, role: u.role };
};

export interface SeedBatchSpec {
  channel: Channel;
  network: Network;
  items: number;
  status: "draft" | "approved" | "rejected" | "completed" | "completed_with_issues" | "failed";
  daysAgo: number;
  failures?: number;
  reconciliations?: number;
}

/** A spread of batches across every status and both channels. */
export const SEED_SPECS: SeedBatchSpec[] = [
  { channel: "mexc", network: "TRC20", items: 42, status: "completed", daysAgo: 21 },
  { channel: "trust_wallet", network: "BEP20", items: 18, status: "completed", daysAgo: 18 },
  { channel: "mexc", network: "TRC20", items: 35, status: "completed_with_issues", daysAgo: 14, failures: 2, reconciliations: 1 },
  { channel: "mexc", network: "BEP20", items: 12, status: "rejected", daysAgo: 12 },
  { channel: "trust_wallet", network: "ERC20", items: 9, status: "completed", daysAgo: 10 },
  { channel: "mexc", network: "ERC20", items: 6, status: "failed", daysAgo: 8, failures: 6 },
  { channel: "mexc", network: "TRC20", items: 64, status: "completed", daysAgo: 6 },
  { channel: "trust_wallet", network: "BEP20", items: 24, status: "completed_with_issues", daysAgo: 4, reconciliations: 2 },
  { channel: "mexc", network: "TRC20", items: 28, status: "approved", daysAgo: 2 },
  { channel: "trust_wallet", network: "BEP20", items: 15, status: "approved", daysAgo: 1 },
  { channel: "mexc", network: "TRC20", items: 51, status: "draft", daysAgo: 1 },
  { channel: "trust_wallet", network: "ERC20", items: 7, status: "draft", daysAgo: 0 },
];

export const FAILURE_REASONS = [
  "Withdrawal address is not on the MEXC whitelist.",
  "Exchange rejected the withdrawal: daily limit reached.",
  "Address format rejected by provider.",
];
export const RECON_REASON = "Provider timed out; on-chain status unknown. Manual reconciliation required.";

export function referenceFor(batchNo: number, i: number): string {
  return `WD-${batchNo}-${String(i + 1).padStart(3, "0")}`;
}
