/**
 * Withdrawal-list validation rules used by the mock backend. Messages are what a
 * backend would send (English); the UI displays them verbatim under the row number.
 */
import { isAddress } from "viem";
import { compareDecimals, isDecimalString, isZero, normalizeDecimal, sumDecimals } from "@/lib/amount";
import { NETWORKS, type Channel, type Issue, type Network, type RowError, type ValidationResult } from "../schemas";
import { REQUIRED_COLUMNS, SUPPORTED_ASSETS } from "./constants";

export interface SheetRow {
  /** Excel row number (header is row 1, first data row is 2). */
  row: number;
  values: Record<string, string>;
}

export interface ParsedSheet {
  headers: string[];
  rows: SheetRow[];
}

export interface ValidRow {
  row: number;
  reference: string;
  address: string;
  amount: string;
  asset: string;
  network: Network;
  memo?: string;
}

export interface ValidationOutcome extends ValidationResult {
  rows: ValidRow[];
}

const TRON_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const MAX_DECIMALS = 6;

export function isValidAddress(address: string, network: Network): boolean {
  if (network === "TRC20") return TRON_RE.test(address);
  return isAddress(address, { strict: true });
}

export function validateSheet(
  sheet: ParsedSheet | null,
  channel: Channel,
  limits: { maxRows: number; maxBatchTotal: string },
): ValidationOutcome {
  const errors = new Map<number, { messages: string[]; issues: Issue[] }>();
  /** Same shape as the real backend: English message + stable issue code (+ params) for i18n. */
  const add = (row: number, msg: string, code: string, params?: Issue["params"]) => {
    const entry = errors.get(row) ?? { messages: [], issues: [] };
    entry.messages.push(msg);
    entry.issues.push(params ? { code, params } : { code });
    errors.set(row, entry);
  };
  const result = (rows: ValidRow[], total: string, asset?: string, network?: Network, rowCount = rows.length): ValidationOutcome => {
    const list: RowError[] = [...errors.entries()].sort(([a], [b]) => a - b).map(([row, e]) => ({ row, ...e }));
    return { valid: list.length === 0, rowCount, totalAmount: total, asset, network, errors: list, rows };
  };

  if (!sheet) {
    add(0, "The file is not a readable .xlsx workbook. Download the template and try again.", "file.unreadable");
    return result([], "0");
  }

  const missing = REQUIRED_COLUMNS.filter((c) => !sheet.headers.includes(c));
  if (missing.length) {
    add(0, `Missing required column(s): ${missing.join(", ")}.`, "file.missing_columns", { columns: [...missing] });
    return result([], "0");
  }

  const dataRows = sheet.rows.filter((r) => Object.values(r.values).some((v) => v.trim() !== ""));
  if (dataRows.length === 0) {
    add(0, "The file contains no withdrawal rows.", "file.empty");
    return result([], "0");
  }
  if (dataRows.length > limits.maxRows) {
    add(0, `The file has ${dataRows.length} rows; the maximum per batch is ${limits.maxRows}.`, "file.too_many_rows", { count: dataRows.length, max: limits.maxRows, channel });
  }

  const seenRefs = new Map<string, number>();
  const assets = new Set<string>();
  const networks = new Set<Network>();
  const valid: ValidRow[] = [];
  const amounts: string[] = [];

  for (const { row, values } of dataRows) {
    const reference = (values.reference ?? "").trim();
    const address = (values.address ?? "").trim();
    const amountRaw = (values.amount ?? "").trim().replace(/,/g, "");
    const asset = (values.asset ?? "").trim().toUpperCase();
    const networkRaw = (values.network ?? "").trim().toUpperCase();
    const memo = (values.memo ?? "").trim() || undefined;
    let ok = true;

    if (!reference) {
      add(row, "Reference is required.", "reference.required");
      ok = false;
    } else if (seenRefs.has(reference)) {
      add(row, `Duplicate reference "${reference}" (also on row ${seenRefs.get(reference)}).`, "reference.duplicate", { reference, firstRow: seenRefs.get(reference)! });
      ok = false;
    } else {
      seenRefs.set(reference, row);
    }

    let network: Network | undefined;
    if (!networkRaw) {
      add(row, "Network is required (TRC20, BEP20 or ERC20).", "network.unsupported", { value: "" });
      ok = false;
    } else if (!(NETWORKS as readonly string[]).includes(networkRaw)) {
      add(row, `Unsupported network "${values.network}". Use TRC20, BEP20 or ERC20.`, "network.unsupported", { value: values.network ?? "" });
      ok = false;
    } else {
      network = networkRaw as Network;
      if (channel === "trust_wallet" && network === "TRC20") {
        add(row, "Trust Wallet batches support BEP20 or ERC20 only.", "network.unsupported_for_channel", { network: networkRaw, channel });
        ok = false;
      }
      networks.add(network);
    }

    if (!asset) {
      add(row, "Asset is required.", "asset.unsupported", { value: "" });
      ok = false;
    } else if (!(SUPPORTED_ASSETS as readonly string[]).includes(asset)) {
      add(row, `Unsupported asset "${values.asset}". Supported: ${SUPPORTED_ASSETS.join(", ")}.`, "asset.unsupported", { value: values.asset ?? "" });
      ok = false;
    } else {
      assets.add(asset);
    }

    if (!address) {
      add(row, "Address is required.", "address.invalid", { address: "", network: network ?? networkRaw });
      ok = false;
    } else if (network && !isValidAddress(address, network)) {
      add(row, `"${address}" is not a valid ${network} address.`, "address.invalid", { address, network });
      ok = false;
    }

    if (!amountRaw) {
      add(row, "Amount is required.", "amount.not_number", { value: "" });
      ok = false;
    } else if (!isDecimalString(amountRaw)) {
      add(row, `Amount "${values.amount}" is not a positive number.`, amountRaw.startsWith("-") ? "amount.not_positive" : "amount.not_number", { value: values.amount ?? "" });
      ok = false;
    } else if (isZero(amountRaw)) {
      add(row, "Amount must be greater than zero.", "amount.zero", { value: amountRaw });
      ok = false;
    } else if ((amountRaw.split(".")[1] ?? "").replace(/0+$/, "").length > MAX_DECIMALS) {
      add(row, `Amount has more than ${MAX_DECIMALS} decimal places.`, "amount.too_precise", { value: amountRaw, max: MAX_DECIMALS });
      ok = false;
    }

    if (ok && network) {
      const amount = normalizeDecimal(amountRaw);
      amounts.push(amount);
      valid.push({ row, reference, address, amount, asset, network, memo });
    }
  }

  if (assets.size > 1) add(0, `A batch must contain a single asset; found ${[...assets].join(", ")}.`, "asset.unsupported", { value: [...assets].join(", ") });
  if (networks.size > 1) add(0, `A batch must use a single network; found ${[...networks].join(", ")}.`, "file.mixed_network", { networks: [...networks].sort() });

  const total = sumDecimals(amounts);
  if (compareDecimals(total, limits.maxBatchTotal) > 0) {
    add(0, `Batch total ${total} exceeds the per-batch limit of ${limits.maxBatchTotal}.`, "batch.total_exceeds_limit", { total, limit: limits.maxBatchTotal });
  }

  const [asset] = assets;
  const [network] = networks;
  return result(valid, total, assets.size === 1 ? asset : undefined, networks.size === 1 ? network : undefined, dataRows.length);
}
