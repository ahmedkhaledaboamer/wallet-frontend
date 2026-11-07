"use client";

import { Layers, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChannelIcon } from "@/components/common/channel";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { EmptyState, ErrorState } from "@/components/common/states";
import { useBatches } from "@/lib/api/queries";
import { BATCH_STATUSES, CHANNELS, type BatchStatus, type Channel } from "@/lib/api/schemas";
import { useSession } from "@/lib/session";
import { BatchesTable } from "./batches-table";

const ALL = "all";
const PAGE_SIZE = 20;

function useBatchFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const rawStatus = params.get("status");
  const rawChannel = params.get("channel");
  const status = (BATCH_STATUSES as readonly string[]).includes(rawStatus ?? "") ? (rawStatus as BatchStatus) : undefined;
  const channel = (CHANNELS as readonly string[]).includes(rawChannel ?? "") ? (rawChannel as Channel) : undefined;
  const page = Math.max(1, Number(params.get("page")) || 1);

  const set = (next: { status?: BatchStatus; channel?: Channel; page?: number }) => {
    const q = new URLSearchParams();
    const merged = { status, channel, page: 1, ...next };
    if (merged.status) q.set("status", merged.status);
    if (merged.channel) q.set("channel", merged.channel);
    if (merged.page > 1) q.set("page", String(merged.page));
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };
  return { status, channel, page, set };
}

export function BatchesView() {
  const t = useTranslations();
  const session = useSession();
  const { status, channel, page, set } = useBatchFilters();
  const query = useBatches({ status, channel, page, pageSize: PAGE_SIZE });
  const filtered = Boolean(status || channel);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title={t("batches.title")}
        description={t("batches.subtitle")}
        actions={
          session?.user.role === "maker" ? (
            <Button asChild size="lg">
              <Link href="/payouts/new">
                <Plus aria-hidden />
                {t("nav.newPayout")}
              </Link>
            </Button>
          ) : null
        }
      />

      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-end sm:p-5">
          <div className="grid gap-1.5 sm:w-56">
            <Label htmlFor="filter-status" className="text-xs text-muted-foreground">
              {t("batches.filterStatus")}
            </Label>
            <Select value={status ?? ALL} onValueChange={(v) => set({ status: v === ALL ? undefined : (v as BatchStatus) })}>
              <SelectTrigger id="filter-status" className="w-full" data-testid="filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("batches.allStatuses")}</SelectItem>
                {BATCH_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 sm:w-56">
            <Label htmlFor="filter-channel" className="text-xs text-muted-foreground">
              {t("batches.filterChannel")}
            </Label>
            <Select value={channel ?? ALL} onValueChange={(v) => set({ channel: v === ALL ? undefined : (v as Channel) })}>
              <SelectTrigger id="filter-channel" className="w-full" data-testid="filter-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("batches.allChannels")}</SelectItem>
                {CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    <ChannelIcon channel={c} className="size-4 text-primary" />
                    {t(`channel.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filtered && (
            <Button variant="ghost" onClick={() => set({ status: undefined, channel: undefined })} className="sm:ms-1">
              <X aria-hidden />
              {t("common.clearFilters")}
            </Button>
          )}
        </div>

        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data && query.data.data.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={filtered ? t("batches.emptyTitle") : t("batches.emptyNoneTitle")}
            description={filtered ? t("batches.emptyBody") : t("batches.emptyNoneBody")}
            action={
              filtered ? (
                <Button variant="outline" onClick={() => set({ status: undefined, channel: undefined })}>
                  {t("common.clearFilters")}
                </Button>
              ) : session?.user.role === "maker" ? (
                <Button asChild>
                  <Link href="/payouts/new">{t("dashboard.emptyCta")}</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className={query.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
            <BatchesTable batches={query.data?.data} loading={query.isLoading} skeletonRows={8} />
          </div>
        )}

        {query.data && query.data.meta.total > 0 && (
          <div className="border-t border-border px-4 py-3 sm:px-6">
            <Pagination meta={query.data.meta} onPageChange={(p) => set({ page: p })} />
          </div>
        )}
      </Card>
    </div>
  );
}
