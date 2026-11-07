"use client";

import { ScrollText, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { EmptyState, ErrorState } from "@/components/common/states";
import { useAuditLog } from "@/lib/api/queries";
import { AuditContext, useActionLabel } from "./audit-format";

const ALL = "all";
const PAGE_SIZE = 50;
export const KNOWN_ACTIONS = [
  "batch.created",
  "batch.approved",
  "batch.rejected",
  "batch.execution_started",
  "batch.transaction_submitted",
  "batch.completed",
  "batch.completed_with_issues",
  "batch.failed",
  "item.failed",
  "item.requires_reconciliation",
] as const;

export function AuditView() {
  const t = useTranslations();
  const format = useFormatter();
  const label = useActionLabel();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const batchId = params.get("batchId") ?? "";
  const action = params.get("action") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [batchInput, setBatchInput] = useState(batchId);

  const set = (next: { batchId?: string; action?: string; page?: number }) => {
    const merged = { batchId, action, page: 1, ...next };
    const q = new URLSearchParams();
    if (merged.batchId) q.set("batchId", merged.batchId);
    if (merged.action) q.set("action", merged.action);
    if (merged.page > 1) q.set("page", String(merged.page));
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  // Debounce the free-text batch filter into the URL.
  useEffect(() => {
    const v = batchInput.trim();
    if (v === batchId) return;
    const id = setTimeout(() => set({ batchId: v }), 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `set` is recreated each render
  }, [batchInput, batchId]);

  const query = useAuditLog({ batchId: batchId || undefined, action: action || undefined, page, pageSize: PAGE_SIZE });
  const filtered = Boolean(batchId || action);
  const clear = () => {
    setBatchInput("");
    set({ batchId: "", action: "" });
  };
  const time = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "medium" });

  return (
    <div className="animate-fade-up">
      <PageHeader title={t("audit.title")} description={t("audit.subtitle")} />
      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-end sm:p-5">
          <div className="grid gap-1.5 sm:w-56">
            <Label htmlFor="audit-batch" className="text-xs text-muted-foreground">
              {t("audit.filterBatch")}
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="audit-batch"
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                placeholder={t("audit.filterBatchPlaceholder")}
                className="ps-9"
                dir="ltr"
                data-testid="audit-batch"
              />
            </div>
          </div>
          <div className="grid gap-1.5 sm:w-64">
            <Label htmlFor="audit-action" className="text-xs text-muted-foreground">
              {t("audit.filterAction")}
            </Label>
            <Select value={action || ALL} onValueChange={(v) => set({ action: v === ALL ? "" : v })}>
              <SelectTrigger id="audit-action" className="w-full" data-testid="audit-action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("audit.allActions")}</SelectItem>
                {KNOWN_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {label(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filtered && (
            <Button variant="ghost" onClick={clear}>
              <X aria-hidden />
              {t("common.clearFilters")}
            </Button>
          )}
        </div>

        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.isLoading ? (
          <div className="space-y-2 p-5" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        ) : query.data && query.data.data.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title={t("audit.emptyTitle")}
            description={filtered ? t("audit.emptyBody") : undefined}
            action={
              filtered ? (
                <Button variant="outline" onClick={clear}>
                  {t("common.clearFilters")}
                </Button>
              ) : undefined
            }
          />
        ) : query.data ? (
          <div className={query.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <div className="hidden md:block">
              <Table data-testid="audit-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="ps-6">{t("audit.colTime")}</TableHead>
                    <TableHead>{t("audit.colAction")}</TableHead>
                    <TableHead>{t("audit.colBatch")}</TableHead>
                    <TableHead>{t("audit.colActor")}</TableHead>
                    <TableHead className="pe-6">{t("audit.colDetails")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.data.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="ps-6 tabular-nums text-muted-foreground">{time(e.createdAt)}</TableCell>
                      <TableCell className="font-medium">{label(e.action)}</TableCell>
                      <TableCell>
                        <Link href={`/batches/${encodeURIComponent(e.batchId)}`} className="font-medium text-link tabular-nums hover:text-link-hover hover:underline" dir="ltr">
                          {e.batchId}
                        </Link>
                      </TableCell>
                      <TableCell>{e.actor ? e.actor.name : <span className="text-muted-foreground">{t("batch.audit.system")}</span>}</TableCell>
                      <TableCell className="max-w-md pe-6 whitespace-normal">
                        <AuditContext context={e.context} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y divide-border md:hidden">
              {query.data.data.map((e) => (
                <li key={e.id} className="space-y-1.5 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium">{label(e.action)}</p>
                    <Link href={`/batches/${encodeURIComponent(e.batchId)}`} className="text-sm font-medium text-link tabular-nums" dir="ltr">
                      {e.batchId}
                    </Link>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {e.actor?.name ?? t("batch.audit.system")} · <span className="tabular-nums">{time(e.createdAt)}</span>
                  </p>
                  <AuditContext context={e.context} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {query.data && query.data.meta.total > 0 && (
          <div className="border-t border-border px-4 py-3 sm:px-6">
            <Pagination meta={query.data.meta} onPageChange={(p) => set({ page: p })} />
          </div>
        )}
      </Card>
    </div>
  );
}
