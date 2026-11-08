"use client";

import { FileSpreadsheet, Loader2, Search, SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDeferredValue, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyButton, ExplorerLink, HashValue } from "@/components/common/address";
import { Money } from "@/components/common/money";
import { Pagination } from "@/components/common/pagination";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState, useErrorMessage } from "@/components/common/states";
import { api } from "@/lib/api";
import { useBatchItems, useConfig } from "@/lib/api/queries";
import { ITEM_STATUSES, type Batch, type BatchItem, type ItemStatus } from "@/lib/api/schemas";
import { addressUrl } from "@/lib/explorer";
import { cn } from "@/lib/utils";

const ALL = "all";
const PAGE_SIZE = 50;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function ProviderRef({ item }: { item: BatchItem }) {
  const t = useTranslations("common");
  if (!item.providerReference) return <span className="text-muted-foreground">{t("none")}</span>;
  const isHash = /^(0x)?[0-9a-f]{64}$/i.test(item.providerReference);
  if (isHash) return <HashValue value={item.providerReference} href={item.explorerUrl} kind="txHash" head={8} tail={6} />;
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="num font-mono text-[0.8125rem]">{item.providerReference}</span>
      <CopyButton value={item.providerReference} label={item.providerReference} />
      <ExplorerLink href={item.explorerUrl} />
    </span>
  );
}

export function BatchItems({ batch }: { batch: Batch }) {
  const t = useTranslations();
  const config = useConfig();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ItemStatus>();
  const [page, setPage] = useState(1);
  const debounced = useDeferredValue(useDebounced(search.trim(), 300));
  const query = useBatchItems(batch.id, { search: debounced || undefined, status, page, pageSize: PAGE_SIZE }, batch.status === "processing");
  const filtered = Boolean(debounced || status);
  const errorMessage = useErrorMessage();
  const [exporting, setExporting] = useState(false);

  /** Downloads exactly what the table shows: the current status filter and search, all pages. */
  const exportExcel = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await api().downloadBatchItems(batch.id, { status, search: debounced || undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="gap-0 py-0" data-testid="batch-items">
      {/* One layout at every width: title, full-width search, then status filter + Download Excel. */}
      <CardHeader className="flex flex-col gap-3 border-b border-border py-4 sm:py-5">
        <CardTitle className="text-lg">{t("batch.items.title")}</CardTitle>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
          <div className="relative sm:basis-full">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("batch.items.search")}
              aria-label={t("batch.items.search")}
              className="h-9 ps-9"
              data-testid="items-search"
            />
          </div>
          <Select
            value={status ?? ALL}
            onValueChange={(v) => {
              setStatus(v === ALL ? undefined : (v as ItemStatus));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-full sm:min-w-44 sm:flex-1" aria-label={t("batches.filterStatus")} data-testid="items-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("batch.items.allStatuses")}</SelectItem>
              {ITEM_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="h-9 shrink-0"
            onClick={exportExcel}
            disabled={exporting || !query.data?.meta.total}
            title={t("batch.items.exportHint")}
            data-testid="items-export"
          >
            {exporting ? <Loader2 className="animate-spin" aria-hidden /> : <FileSpreadsheet aria-hidden />}
            {exporting ? t("batch.items.exporting") : t("batch.items.export")}
          </Button>
        </div>
      </CardHeader>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
      ) : query.isLoading ? (
        <div className="space-y-2 p-5" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      ) : query.data && query.data.data.length === 0 ? (
        <EmptyState icon={SearchX} title={t("batch.items.emptyTitle")} description={filtered ? t("batch.items.emptyBody") : undefined} compact />
      ) : query.data ? (
        <div className={query.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {/* Desktop */}
          <div className="hidden lg:block">
            <Table data-testid="items-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="ps-6">{t("batch.items.colReference")}</TableHead>
                  <TableHead>{t("batch.items.colAddress")}</TableHead>
                  <TableHead className="text-end">{t("batch.items.colAmount")}</TableHead>
                  <TableHead>{t("batch.items.colStatus")}</TableHead>
                  <TableHead className="pe-6">{t("batch.items.colProvider")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((it) => (
                  <TableRow key={it.id} data-testid="item-row" data-item-status={it.status}>
                    <TableCell className="ps-6">
                      <span className="font-medium tabular-nums" dir="ltr">
                        {it.reference}
                      </span>
                      {it.memo && <p className="text-xs text-muted-foreground">{t("batch.items.memo", { memo: it.memo })}</p>}
                    </TableCell>
                    <TableCell>
                      <HashValue value={it.address} href={addressUrl(config.data, batch.network, it.address)} />
                    </TableCell>
                    <TableCell className="text-end font-semibold">
                      <Money value={it.amount} asset={batch.asset} />
                    </TableCell>
                    <TableCell className="max-w-60 whitespace-normal">
                      <StatusBadge status={it.status} />
                      {it.failureReason && (
                        <p
                          className={cn(
                            "mt-1 text-xs",
                            it.status === "requires_reconciliation" ? "text-status-reconciliation-fg" : "text-status-failed-fg",
                          )}
                          dir="auto"
                          title={t("batch.items.colReason")}
                        >
                          {it.failureReason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="pe-6">
                      <ProviderRef item={it} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Mobile / tablet */}
          <ul className="divide-y divide-border lg:hidden">
            {query.data.data.map((it) => (
              <li key={it.id} className="space-y-2.5 px-4 py-4" data-testid="item-card">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium tabular-nums" dir="ltr">
                    {it.reference}
                  </span>
                  <StatusBadge status={it.status} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <HashValue value={it.address} href={addressUrl(config.data, batch.network, it.address)} />
                  <Money value={it.amount} asset={batch.asset} className="font-semibold" />
                </div>
                {it.providerReference && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{t("batch.items.colProvider")}:</span>
                    <ProviderRef item={it} />
                  </div>
                )}
                {it.failureReason && (
                  <p className="rounded-lg bg-status-failed-bg px-3 py-2 text-xs text-status-failed-fg" dir="auto">
                    {it.failureReason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {query.data && query.data.meta.total > 0 && (
        <div className="border-t border-border px-4 py-3 sm:px-6">
          <Pagination meta={query.data.meta} onPageChange={setPage} />
        </div>
      )}
    </Card>
  );
}
