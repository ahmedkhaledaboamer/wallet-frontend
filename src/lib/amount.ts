/**
 * Money helpers. Amounts travel as decimal strings ("1250.5") and are NEVER
 * converted to JS numbers — all arithmetic happens on BigInt base units.
 * Output always uses Western digits and "," / "." separators, in every locale,
 * so finance users can compare figures across EN and AR screens.
 */

const DECIMAL_RE = /^(\d+)(?:\.(\d+))?$/;

export function isDecimalString(value: string): boolean {
  return DECIMAL_RE.test(value);
}

interface Parsed {
  units: bigint; // value * 10^scale
  scale: number;
}

function parse(value: string): Parsed {
  const trimmed = value.trim();
  const m = DECIMAL_RE.exec(trimmed);
  if (!m) throw new RangeError(`Invalid decimal amount: "${value}"`);
  const fraction = m[2] ?? "";
  return { units: BigInt(m[1] + fraction), scale: fraction.length };
}

function pow10(n: number): bigint {
  return BigInt(10) ** BigInt(n);
}

/** Converts a decimal string to integer base units, e.g. ("1.5", 6) → 1500000n. */
export function toUnits(value: string, decimals: number): bigint {
  const { units, scale } = parse(value);
  if (scale > decimals) {
    // Allow trailing zeros beyond the token precision ("1.500000000" with 6 decimals).
    const excess = pow10(scale - decimals);
    if (units % excess !== BigInt(0)) {
      throw new RangeError(`"${value}" has more than ${decimals} decimal places`);
    }
    return units / excess;
  }
  return units * pow10(decimals - scale);
}

/** Converts base units back to a canonical decimal string, e.g. (1500000n, 6) → "1.5". */
export function fromUnits(units: bigint, decimals: number): string {
  const negative = units < BigInt(0);
  const abs = negative ? -units : units;
  const base = pow10(decimals);
  const int = abs / base;
  const frac = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${int.toString()}${frac ? `.${frac}` : ""}`;
}

/** Canonical form: no leading zeros, no trailing fractional zeros ("001.500" → "1.5"). */
export function normalizeDecimal(value: string): string {
  const { units, scale } = parse(value);
  return fromUnits(units, scale);
}

function align(a: string, b: string): [bigint, bigint, number] {
  const pa = parse(a);
  const pb = parse(b);
  const scale = Math.max(pa.scale, pb.scale);
  return [pa.units * pow10(scale - pa.scale), pb.units * pow10(scale - pb.scale), scale];
}

export function addDecimals(a: string, b: string): string {
  const [x, y, scale] = align(a, b);
  return fromUnits(x + y, scale);
}

export function sumDecimals(values: readonly string[]): string {
  return values.reduce<string>((acc, v) => addDecimals(acc, v), "0");
}

/** -1 | 0 | 1 */
export function compareDecimals(a: string, b: string): -1 | 0 | 1 {
  const [x, y] = align(a, b);
  return x === y ? 0 : x < y ? -1 : 1;
}

export function isZero(value: string): boolean {
  return parse(value).units === BigInt(0);
}

function group(int: string): string {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export interface FormatAmountOptions {
  /** Minimum fraction digits to show (default 2). */
  minFraction?: number;
  /**
   * Maximum fraction digits. Extra digits are TRUNCATED, never rounded up, so a
   * displayed figure is never more than the real one. Default: show all digits.
   */
  maxFraction?: number;
  /** Appended after the number with a thin space, e.g. "USDT". */
  asset?: string;
}

/** "1234567.5" → "1,234,567.50". Non-decimal input is returned unchanged. */
export function formatAmount(value: string, opts: FormatAmountOptions = {}): string {
  const { minFraction = 2, maxFraction, asset } = opts;
  const m = DECIMAL_RE.exec(value.trim());
  if (!m) return value;
  const int = m[1].replace(/^0+(?=\d)/, "");
  let frac = (m[2] ?? "").replace(/0+$/, "");
  if (maxFraction !== undefined && frac.length > maxFraction) frac = frac.slice(0, maxFraction);
  if (frac.length < minFraction) frac = frac.padEnd(minFraction, "0");
  const out = `${group(int)}${frac ? `.${frac}` : ""}`;
  return asset ? `${out} ${asset}` : out;
}

/** Integer counts with Western grouping: 12345 → "12,345". */
export function formatCount(n: number): string {
  return group(Math.trunc(n).toString());
}

/** Percentage of two integer counts, clamped to 0–100. */
export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((part / whole) * 100)));
}

/** Share of `part` in `whole` as an integer percentage (0–100), computed on BigInt. */
export function sharePercent(part: string, whole: string): number {
  const [p, w] = align(part, whole);
  if (w === BigInt(0)) return 0;
  const pct = (p * BigInt(1000)) / w; // tenths of a percent
  return Math.min(100, Math.round(Number(pct) / 10));
}
