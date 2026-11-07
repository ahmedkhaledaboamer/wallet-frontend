/**
 * Generates the .xlsx fixtures used by e2e tests (and handy for manual demos).
 * Run: npm run fixtures
 */
import { mkdir, writeFile } from "node:fs/promises";
import { getAddress } from "viem";
import { buildWorkbook, type TemplateRow } from "../src/lib/api/mock/xlsx";

const OUT = "e2e/fixtures";

const tron = (i: number) => `TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDe${"ABCDEFGHJK"[i % 10]}`;
const evm = (i: number) => getAddress(`0x${(i + 1).toString(16).padStart(2, "0").repeat(20)}`);

const mexcRows: TemplateRow[] = Array.from({ length: 8 }, (_, i) => ({
  reference: `WD-E2E-${String(i + 1).padStart(3, "0")}`,
  address: tron(i),
  amount: ["125.50", "980", "42.75", "1500.00", "310.20", "75", "2200.10", "18.99"][i],
  asset: "USDT",
  network: "TRC20",
}));

const trustRows: TemplateRow[] = Array.from({ length: 5 }, (_, i) => ({
  reference: `TW-E2E-${String(i + 1).padStart(3, "0")}`,
  address: evm(i),
  amount: ["250.00", "99.99", "1200", "45.5", "610.25"][i],
  asset: "USDT",
  network: "BEP20",
}));

const issuesRows: TemplateRow[] = [
  ...mexcRows.slice(0, 4),
  { reference: "WD-E2E-101-FAIL", address: tron(5), amount: "60", asset: "USDT", network: "TRC20" },
  { reference: "WD-E2E-102-RECON", address: tron(6), amount: "75.25", asset: "USDT", network: "TRC20" },
];

const invalidRows: TemplateRow[] = [
  { reference: "WD-BAD-001", address: tron(1), amount: "100", asset: "USDT", network: "TRC20" },
  { reference: "WD-BAD-002", address: "not-an-address", amount: "50", asset: "USDT", network: "TRC20" },
  { reference: "WD-BAD-003", address: tron(3), amount: "", asset: "USDT", network: "TRC20" },
  { reference: "WD-BAD-001", address: tron(4), amount: "-20", asset: "USDT", network: "TRC20" },
  { reference: "WD-BAD-005", address: tron(5), amount: "10.1234567", asset: "BTC", network: "TRC20" },
  { reference: "WD-BAD-006", address: tron(6), amount: "12", asset: "USDT", network: "SOL" },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const files: [string, TemplateRow[]][] = [
    ["valid-mexc.xlsx", mexcRows],
    ["valid-trust.xlsx", trustRows],
    ["mexc-with-issues.xlsx", issuesRows],
    ["invalid.xlsx", invalidRows],
  ];
  for (const [name, rows] of files) {
    await writeFile(`${OUT}/${name}`, new Uint8Array(await buildWorkbook(rows)));
    console.log(`wrote ${OUT}/${name} (${rows.length} rows)`);
  }
  await writeFile(`${OUT}/not-excel.xlsx`, "this is not a workbook");
  console.log(`wrote ${OUT}/not-excel.xlsx`);
}

void main();
