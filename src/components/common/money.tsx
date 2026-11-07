import { cn } from "@/lib/utils";
import { formatAmount, formatCount } from "@/lib/amount";

/**
 * A money amount: Western digits, LTR, tabular figures — in every locale.
 * `value` is the API's decimal string; it is never converted to a JS number.
 */
export function Money({
  value,
  asset,
  maxFraction,
  className,
  assetClassName,
}: {
  value: string;
  asset?: string;
  maxFraction?: number;
  className?: string;
  assetClassName?: string;
}) {
  return (
    <span className={cn("num inline-flex items-baseline gap-1 whitespace-nowrap", className)} dir="ltr">
      <span>{formatAmount(value, { maxFraction })}</span>
      {asset && <span className={cn("text-[0.78em] font-medium text-muted-foreground", assetClassName)}>{asset}</span>}
    </span>
  );
}

/** Integer count with Western digits. */
export function Count({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("num", className)} dir="ltr">
      {formatCount(value)}
    </span>
  );
}
