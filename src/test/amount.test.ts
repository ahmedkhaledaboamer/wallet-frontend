import { describe, expect, it } from "vitest";
import {
  addDecimals,
  compareDecimals,
  formatAmount,
  formatCount,
  fromUnits,
  isDecimalString,
  normalizeDecimal,
  percent,
  sharePercent,
  sumDecimals,
  toUnits,
} from "@/lib/amount";

describe("formatAmount", () => {
  it("groups thousands with Western digits and pads to 2 decimals", () => {
    expect(formatAmount("1234567.5")).toBe("1,234,567.50");
    expect(formatAmount("0")).toBe("0.00");
    expect(formatAmount("12")).toBe("12.00");
  });

  it("keeps every significant fraction digit by default (no rounding)", () => {
    expect(formatAmount("0.123456")).toBe("0.123456");
    expect(formatAmount("1000.10")).toBe("1,000.10");
  });

  it("truncates (never rounds up) when maxFraction is set", () => {
    expect(formatAmount("9.999", { maxFraction: 2 })).toBe("9.99");
    expect(formatAmount("1999999.995", { maxFraction: 2 })).toBe("1,999,999.99");
  });

  it("is exact beyond Number precision", () => {
    // 2^53 + 1 cannot be represented as a JS number
    expect(formatAmount("9007199254740993.000000000000000001")).toBe("9,007,199,254,740,993.000000000000000001");
  });

  it("strips leading zeros and appends the asset", () => {
    expect(formatAmount("000123.4", { asset: "USDT" })).toBe("123.40 USDT");
  });

  it("returns non-decimal input unchanged instead of NaN", () => {
    expect(formatAmount("abc")).toBe("abc");
    expect(formatAmount("-5")).toBe("-5");
  });

  it("formats counts and percentages", () => {
    expect(formatCount(1234567)).toBe("1,234,567");
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 0)).toBe(0);
  });
});

describe("decimal arithmetic", () => {
  it("adds without floating-point error", () => {
    expect(addDecimals("0.1", "0.2")).toBe("0.3");
    expect(sumDecimals(["125.50", "980", "42.75", "1500.00", "310.20", "75", "2200.10", "18.99"])).toBe("5252.54");
  });

  it("compares across scales", () => {
    expect(compareDecimals("1.50", "1.5")).toBe(0);
    expect(compareDecimals("10", "9.999999")).toBe(1);
    expect(compareDecimals("0.000001", "0.00001")).toBe(-1);
  });

  it("normalizes", () => {
    expect(normalizeDecimal("007.2500")).toBe("7.25");
    expect(normalizeDecimal("10.000")).toBe("10");
    expect(isDecimalString("1.")).toBe(false);
    expect(isDecimalString("1e3")).toBe(false);
  });

  it("computes channel share on BigInt", () => {
    expect(sharePercent("358876.75", "471287.06")).toBe(76);
    expect(sharePercent("1", "0")).toBe(0);
  });
});

describe("token units", () => {
  it("converts decimals to base units and back", () => {
    expect(toUnits("2205.74", 18)).toBe(BigInt("2205740000000000000000"));
    expect(toUnits("1.5", 6)).toBe(BigInt(1_500_000));
    expect(fromUnits(BigInt(1_500_000), 6)).toBe("1.5");
    expect(fromUnits(BigInt(0), 6)).toBe("0");
  });

  it("accepts trailing zeros past the token precision but rejects real extra precision", () => {
    expect(toUnits("1.5000000", 6)).toBe(BigInt(1_500_000));
    expect(() => toUnits("1.0000001", 6)).toThrow(RangeError);
  });

  it("rejects malformed input", () => {
    expect(() => toUnits("1,000", 6)).toThrow(RangeError);
    expect(() => toUnits("-1", 6)).toThrow(RangeError);
  });
});
