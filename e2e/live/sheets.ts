/**
 * Withdrawal workbooks for LIVE e2e runs against the real backend.
 * Addresses are checksum-valid (TRON base58check, EIP-55) because the backend validates them,
 * and every sheet carries a unique run tag so the backend's duplicate-file rule never fires.
 */
import { getAddress, sha256 } from "viem";
import { buildWorkbook, type TemplateRow } from "../../src/lib/api/mock/xlsx";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const hexToBytes = (h: string) => Uint8Array.from(h.slice(2).match(/../g)!.map((b) => parseInt(b, 16)));

function base58(bytes: Uint8Array): string {
  let n = BigInt(0);
  for (const b of bytes) n = (n << BigInt(8)) + BigInt(b);
  let out = "";
  while (n > BigInt(0)) {
    out = B58[Number(n % BigInt(58))] + out;
    n /= BigInt(58);
  }
  return out;
}

export function tronAddress(seed: number): string {
  const payload = new Uint8Array(21);
  payload[0] = 0x41;
  for (let k = 1; k < 21; k++) payload[k] = (seed * 131 + k * 29 + 7) & 0xff;
  const check = hexToBytes(sha256(hexToBytes(sha256(payload)))).subarray(0, 4);
  const full = new Uint8Array(25);
  full.set(payload);
  full.set(check, 21);
  return base58(full);
}

export function evmAddress(seed: number): string {
  const body = Array.from({ length: 20 }, (_, k) => ((seed * 37 + k * 11 + 3) & 0xff).toString(16).padStart(2, "0")).join("");
  return getAddress(`0x${body}`);
}

export const runTag = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`.toUpperCase();

export async function sheet(rows: TemplateRow[]): Promise<Buffer> {
  return Buffer.from(await buildWorkbook(rows));
}

/** Valid MEXC TRC20 list; references can carry -FAIL / -RECON suffixes (backend dry-run convention). */
export function mexcRows(tag: string, amounts: string[], suffixes: string[] = []): TemplateRow[] {
  return amounts.map((amount, i) => ({
    reference: `L-${tag}-${i + 1}${suffixes[i] ?? ""}`,
    address: tronAddress(i + tag.charCodeAt(0) * 3),
    amount,
    asset: "USDT",
    network: "TRC20",
  }));
}

export function trustRows(tag: string, amounts: string[]): TemplateRow[] {
  return amounts.map((amount, i) => ({
    reference: `TW-${tag}-${i + 1}`,
    address: evmAddress(i + tag.charCodeAt(1)),
    amount,
    asset: "USDT",
    network: "BEP20",
  }));
}

/** Every row broken in a different way (Excel rows 2–6). */
export function invalidRows(tag: string): TemplateRow[] {
  return [
    { reference: `BAD-${tag}-1`, address: "not-an-address", amount: "10", asset: "USDT", network: "TRC20" },
    { reference: `BAD-${tag}-2`, address: tronAddress(900), amount: "", asset: "USDT", network: "TRC20" },
    { reference: `BAD-${tag}-1`, address: tronAddress(901), amount: "10", asset: "USDT", network: "TRC20" },
    { reference: `BAD-${tag}-4`, address: tronAddress(902), amount: "10", asset: "BTC", network: "TRC20" },
    { reference: `BAD-${tag}-5`, address: tronAddress(903), amount: "0.5", asset: "USDT", network: "TRC20" },
  ];
}
