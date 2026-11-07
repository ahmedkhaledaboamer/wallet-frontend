"use client";

import { useTranslations } from "next-intl";
import { formatCount, percent } from "@/lib/amount";
import type { Batch } from "@/lib/api/schemas";
import { cn } from "@/lib/utils";

/** Segmented progress: paid (green) · failed (red) · needs reconciliation (amber), out of itemCount. */
export function BatchProgress({ batch }: { batch: Batch }) {
  const t = useTranslations("batch");
  const total = Math.max(1, batch.itemCount);
  const seg = (n: number) => `${(n / total) * 100}%`;
  const processing = batch.status === "processing";
  const pct = percent(batch.paidCount, batch.itemCount);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-medium">
          {t("progressLabel", { paid: formatCount(batch.paidCount), total: formatCount(batch.itemCount) })}
        </p>
        <p className="num text-sm font-semibold text-muted-foreground">{formatCount(pct)}%</p>
      </div>
      <div
        role="progressbar"
        aria-label={t("progress")}
        aria-valuemin={0}
        aria-valuemax={batch.itemCount}
        aria-valuenow={batch.paidCount}
        aria-valuetext={t("progressLabel", { paid: formatCount(batch.paidCount), total: formatCount(batch.itemCount) })}
        className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
        data-testid="batch-progress"
      >
        <span
          className={cn(
            "h-full bg-status-succeeded-dot transition-[width] duration-700 ease-out",
            processing &&
              "animate-progress-stripes bg-stripes",
          )}
          style={{ width: seg(batch.paidCount) }}
        />
        <span className="h-full bg-status-failed-dot transition-[width] duration-700" style={{ width: seg(batch.failedCount) }} />
        <span className="h-full bg-status-reconciliation-dot transition-[width] duration-700" style={{ width: seg(batch.reconciliationCount) }} />
      </div>
      {(batch.failedCount > 0 || batch.reconciliationCount > 0) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {batch.failedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-status-failed-fg">
              <span aria-hidden className="size-2 rounded-full bg-status-failed-dot" />
              {t("progressFailed", { count: formatCount(batch.failedCount) })}
            </span>
          )}
          {batch.reconciliationCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-status-reconciliation-fg">
              <span aria-hidden className="size-2 rounded-full bg-status-reconciliation-dot" />
              {t("progressRecon", { count: formatCount(batch.reconciliationCount) })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
