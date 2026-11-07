/**
 * Excel I/O for the mock backend (and the e2e fixture generator), using exceljs.
 * exceljs is loaded lazily so it never lands in the main bundle.
 */
import type { Cell, Workbook } from "exceljs";
import { TEMPLATE_COLUMNS } from "./constants";
import type { ParsedSheet } from "./validate";

async function newWorkbook(): Promise<Workbook> {
  const mod = await import("exceljs");
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  return new ExcelJS.Workbook();
}

function cellText(cell: Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v); // shortest round-trip representation
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v && typeof v.text === "string") return v.text; // hyperlink
    if ("result" in v && v.result !== undefined) return String(v.result); // formula
  }
  return cell.text ?? "";
}

/** Returns null if the bytes are not a readable workbook. */
export async function parseWorkbook(data: ArrayBuffer): Promise<ParsedSheet | null> {
  const wb = await newWorkbook();
  try {
    await wb.xlsx.load(data);
  } catch {
    return null;
  }
  const ws = wb.worksheets[0];
  if (!ws) return null;

  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cellText(cell).trim().toLowerCase();
  });

  const rows: ParsedSheet["rows"] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const values: Record<string, string> = {};
    headers.forEach((h, col) => {
      if (h) values[h] = cellText(row.getCell(col));
    });
    rows.push({ row: rowNumber, values });
  });
  return { headers: headers.filter(Boolean), rows };
}

export type TemplateRow = Partial<Record<(typeof TEMPLATE_COLUMNS)[number], string>>;

/** Builds the withdrawal template (or a fixture when rows are passed). */
export async function buildWorkbook(rows: TemplateRow[] = []): Promise<ArrayBuffer> {
  const wb = await newWorkbook();
  wb.creator = "Apexaora Batch Payouts";
  const ws = wb.addWorksheet("Withdrawals", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "reference", key: "reference", width: 22 },
    { header: "address", key: "address", width: 48 },
    { header: "amount", key: "amount", width: 14, style: { numFmt: "@" } }, // text: keeps exact decimals
    { header: "asset", key: "asset", width: 10 },
    { header: "network", key: "network", width: 12 },
    { header: "memo", key: "memo", width: 20 },
  ];
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF7549AA" } };
  for (const r of rows) ws.addRow(r);

  const notes = wb.addWorksheet("Instructions");
  notes.columns = [{ width: 100 }];
  [
    "One row per withdrawal. Keep the header row exactly as is.",
    "reference: your unique ID for the payout (e.g. WD-2026-0001).",
    "address: recipient wallet address on the chosen network.",
    "amount: decimal amount as text, e.g. 125.50 (max 6 decimal places).",
    "asset: USDT. network: TRC20, BEP20 or ERC20 (one network per file).",
    "Trust Wallet batches support BEP20 or ERC20 only.",
    "TESTNET ONLY — never put real customer addresses in this demo.",
  ].forEach((line) => notes.addRow([line]));

  const buf = await wb.xlsx.writeBuffer();
  // Node returns a pooled Buffer: copy into an exactly-sized ArrayBuffer.
  return new Uint8Array(buf as ArrayBuffer).slice().buffer;
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
