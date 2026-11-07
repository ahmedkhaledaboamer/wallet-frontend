"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChannelLabel, NetworkChip } from "@/components/common/channel";
import { Money } from "@/components/common/money";
import { StatusBadge } from "@/components/common/status-badge";
import { formatCount } from "@/lib/amount";
import type { Batch } from "@/lib/api/schemas";
import { cn } from "@/lib/utils";

function MiniProgress({ batch }: { batch: Batch }) {
  const t = useTranslations("batches");
  const pct = batch.itemCount ? (batch.paidCount / batch.itemCount) * 100 : 0;
  return (
    <div className="flex min-w-24 flex-col gap-1">
      <span className="num text-xs text-muted-foreground">
        {t("progressOf", { paid: formatCount(batch.paidCount), total: formatCount(batch.itemCount) })}
      </span>
      <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-700",
            batch.status === "processing" ? "bg-status-processing-dot" : batch.failedCount || batch.reconciliationCount ? "bg-status-reconciliation-dot" : "bg-status-succeeded-dot",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
    </div>
  );
}

export function BatchesTable({
  batches,
  loading,
  skeletonRows = 6,
  compact = false,
}: {
  batches?: Batch[];
  loading?: boolean;
  skeletonRows?: number;
  /** Fewer columns, for narrow containers such as the dashboard. */
  compact?: boolean;
}) {
  const wide = compact ? "hidden 2xl:table-cell" : "";
  const t = useTranslations("batches");
  const format = useFormatter();
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });

  if (loading && !batches) {
    return (
      <div className="space-y-2 p-4 sm:p-6" aria-busy="true">
        {Array.from({ length: skeletonRows }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (!batches) return null;

  return (
    <>
      {/* Desktop / tablet */}
      <div className="hidden md:block">
        <Table data-testid="batches-table">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="ps-6">{t("colBatch")}</TableHead>
              <TableHead>{t("colChannel")}</TableHead>
              <TableHead className={wide}>{t("colNetwork")}</TableHead>
              <TableHead>{t("colProgress")}</TableHead>
              <TableHead className="text-end">{t("colTotal")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead className={compact ? "hidden" : "hidden xl:table-cell"}>{t("colCreatedBy")}</TableHead>
              <TableHead className="w-10 pe-6">
                <span className="sr-only">{t("openBatch", { id: "" })}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((b) => (
              <TableRow key={b.id} className="group relative cursor-pointer" data-testid={`batch-row-${b.id}`}>
                <TableCell className="ps-6">
                  <Link
                    href={`/batches/${encodeURIComponent(b.id)}`}
                    className="font-semibold text-foreground tabular-nums after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-ring"
                    aria-label={t("openBatch", { id: b.id })}
                  >
                    {b.id}
                  </Link>
                  <div className="mt-0.5 tabular-nums text-xs text-muted-foreground">{date(b.createdAt)}</div>
                </TableCell>
                <TableCell>
                  <ChannelLabel channel={b.channel} short />
                </TableCell>
                <TableCell className={wide}>
                  <NetworkChip network={b.network} asset={b.asset} />
                </TableCell>
                <TableCell>
                  <MiniProgress batch={b} />
                </TableCell>
                <TableCell className="text-end font-semibold">
                  <Money value={b.totalAmount} asset={b.asset} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={b.status} />
                </TableCell>
                <TableCell className={cn("text-muted-foreground", compact ? "hidden" : "hidden xl:table-cell")}>{b.createdBy.name}</TableCell>
                <TableCell className="pe-6">
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-border md:hidden" data-testid="batches-list">
        {batches.map((b) => (
          <li key={b.id} className="relative">
            <Link
              href={`/batches/${encodeURIComponent(b.id)}`}
              className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/50"
              aria-label={t("openBatch", { id: b.id })}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold tabular-nums" dir="ltr">{b.id}</p>
                  <p className="mt-0.5 tabular-nums text-xs text-muted-foreground">{date(b.createdAt)}</p>
                </div>
                <StatusBadge status={b.status} />
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                  <ChannelLabel channel={b.channel} short className="text-sm" />
                  <span className="num text-xs text-muted-foreground" dir="ltr">
                    {t("progressOf", { paid: formatCount(b.paidCount), total: formatCount(b.itemCount) })}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Money value={b.totalAmount} asset={b.asset} className="text-base font-semibold" />
                  <NetworkChip network={b.network} />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
