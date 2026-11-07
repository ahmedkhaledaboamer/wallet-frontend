"use client";

import { useTranslations } from "next-intl";
import { formatAmount, formatCount, isDecimalString } from "@/lib/amount";
import { truncateMiddle } from "@/lib/explorer";
import { cn } from "@/lib/utils";

/** Translated label for an audit action; unknown actions fall back to a readable form. */
export function useActionLabel() {
  const t = useTranslations("audit.actions");
  return (action: string) => {
    const key = action.replace(/\./g, "_");
    return t.has(key as never) ? t(key as never) : action.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  };
}

const AMOUNT_KEYS = new Set(["totalAmount", "paidAmount", "amount"]);
const HASH_KEYS = new Set(["txHash", "from", "address", "treasury"]);
const HIDDEN_KEYS = new Set(["itemId", "fileSha256", "seeded"]);

function renderValue(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return <span className="num">{formatCount(value)}</span>;
  if (typeof value === "string") {
    if (AMOUNT_KEYS.has(key) && isDecimalString(value)) return <span className="num">{formatAmount(value)}</span>;
    if (HASH_KEYS.has(key)) {
      return (
        <span className="num font-mono" title={value}>
          {truncateMiddle(value, 8, 6)}
        </span>
      );
    }
    return <span dir="auto">{value}</span>;
  }
  if (typeof value === "boolean") return String(value);
  return <span className="font-mono">{JSON.stringify(value)}</span>;
}

/** Compact key/value chips for an audit entry's free-form context object. */
export function AuditContext({ context, className }: { context: Record<string, unknown>; className?: string }) {
  const t = useTranslations("audit.context");
  const tc = useTranslations("channel");
  const value = (k: string, v: unknown) =>
    k === "channel" && (v === "mexc" || v === "trust_wallet") ? tc(`${v}Short`) : renderValue(k, v);
  const entries = Object.entries(context).filter(([k, v]) => !HIDDEN_KEYS.has(k) && renderValue(k, v) !== null);
  if (entries.length === 0) return null;
  return (
    <dl className={cn("flex flex-wrap gap-1.5", className)}>
      {entries.map(([k, v]) => (
        <div key={k} className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs">
          <dt className="text-muted-foreground">{t.has(k as never) ? t(k as never) : k}</dt>
          <dd className="min-w-0 truncate font-medium text-foreground">{value(k, v)}</dd>
        </div>
      ))}
    </dl>
  );
}
