"use client";

import { ArrowLeft, FileQuestion, FlaskConical, Radio, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HashValue } from "@/components/common/address";
import { ChannelLabel, NetworkChip } from "@/components/common/channel";
import { Money } from "@/components/common/money";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState } from "@/components/common/states";
import { TrustWalletFlow } from "@/components/wallet/trust-wallet-flow";
import { isApiError } from "@/lib/api/errors";
import { qk, useBatch } from "@/lib/api/queries";
import { useQueryClient } from "@tanstack/react-query";
import { FINAL_BATCH_STATUSES, type Batch, type BatchStatus } from "@/lib/api/schemas";
import { safeHref } from "@/lib/explorer";
import { loadPendingTx } from "@/lib/wallet/payload";
import { AuditTimeline } from "./audit-timeline";
import { BatchActions } from "./batch-actions";
import { BatchItems } from "./batch-items";
import { BatchProgress } from "./batch-progress";

function BackLink() {
  const t = useTranslations("batch");
  return (
    <Link href="/batches" className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
      {t("back")}
    </Link>
  );
}

function DetailsSkeleton() {
  return (
    <div aria-busy="true">
      <BackLink />
      <Skeleton className="mb-6 h-64 w-full rounded-xl" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Skeleton className="h-96 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}

/** Announces status transitions (e.g. processing → completed) while the page polls. */
function useStatusToasts(batch?: Batch) {
  const t = useTranslations();
  const qc = useQueryClient();
  const prev = useRef<BatchStatus | undefined>(undefined);
  useEffect(() => {
    if (!batch) return;
    if (prev.current === "processing" && batch.status !== "processing") {
      // Items/audit stop polling now: fetch them once more so they match the final batch.
      void qc.invalidateQueries({ queryKey: ["batch", batch.id, "items"] });
      void qc.invalidateQueries({ queryKey: qk.batchAudit(batch.id) });
      void qc.invalidateQueries({ queryKey: qk.stats });
      const status = t(`status.${batch.status}`);
      const msg = t("batch.statusChanged", { id: batch.id, status });
      if (batch.status === "completed") toast.success(msg);
      else if (FINAL_BATCH_STATUSES.includes(batch.status)) toast.warning(msg);
    }
    prev.current = batch.status;
  }, [batch, t, qc]);
}

const noop = () => () => {};

function Header({ batch, onStartTrustWallet }: { batch: Batch; onStartTrustWallet: () => void }) {
  const t = useTranslations("batch");
  const tc = useTranslations("common");
  const format = useFormatter();
  const date = (iso?: string) => (iso ? format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : undefined);
  const people = [
    { label: t("createdBy", { name: batch.createdBy.name }), at: date(batch.createdAt) },
    batch.approvedBy && { label: t("approvedBy", { name: batch.approvedBy.name }), at: date(batch.approvedAt) },
    batch.executedBy && { label: t("executedBy", { name: batch.executedBy.name }), at: date(batch.executedAt) },
  ].filter(Boolean) as { label: string; at?: string }[];

  return (
    <Card className="relative mb-6 gap-0 overflow-hidden py-0">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" />
      <CardContent className="grid gap-6 py-6 sm:py-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-bold sm:text-[1.75rem]">
              {t("title", { id: batch.id })}
            </h1>
            <StatusBadge status={batch.status} size="lg" />
            {batch.simulated && (
              <span
                title={t("simulatedHint")}
                data-testid="simulated-badge"
                className="inline-flex items-center gap-1.5 rounded-full border border-testnet-border bg-testnet-bg px-3 py-1 text-xs font-semibold text-testnet-fg"
              >
                <FlaskConical className="size-3.5" aria-hidden />
                {t("simulated")}
              </span>
            )}
            {batch.status === "processing" && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-status-processing-fg">
                <Radio className="size-3.5 animate-pulse" aria-hidden />
                {t("liveUpdating")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <ChannelLabel channel={batch.channel} />
            <NetworkChip network={batch.network} asset={batch.asset} />
          </div>
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("total")}</p>
            <p className="mt-1 font-heading text-3xl font-bold tracking-tight sm:text-4xl" data-testid="batch-total">
              <Money value={batch.totalAmount} asset={batch.asset} assetClassName="text-lg sm:text-xl" />
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tc("items", { count: batch.itemCount })}
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            {people.map((p) => (
              <li key={p.label}>
                <span className="font-medium text-foreground">{p.label}</span>
                {p.at && (
                  <>
                    {" · "}
                    <span className="tabular-nums">{p.at}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:max-w-sm lg:min-w-64 lg:justify-self-end">
          <BatchActions batch={batch} onStartTrustWallet={onStartTrustWallet} />
        </div>
      </CardContent>

      <div className="space-y-4 border-t border-border bg-muted/30 px-5 py-5 sm:px-6">
        <BatchProgress batch={batch} />
        {batch.status === "rejected" && batch.rejectionReason && (
          <div className="flex items-start gap-2 rounded-xl bg-status-failed-bg p-3 text-sm text-status-failed-fg" data-testid="rejection-reason">
            <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">{t("rejectedTitle")}</p>
              <p dir="auto">{batch.rejectionReason}</p>
            </div>
          </div>
        )}
        {batch.txHash && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t("transaction")}:</span>
            <HashValue value={batch.txHash} href={safeHref(batch.explorerUrl)} kind="txHash" head={10} tail={8} />
          </div>
        )}
      </div>
    </Card>
  );
}

export function BatchDetailsView() {
  const t = useTranslations("batch");
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);
  const query = useBatch(id);
  const batch = query.data;
  const [walletOpen, setWalletOpen] = useState(false);
  // A payout tx sent but not yet confirmed (e.g. page reloaded mid-flow) re-opens the flow in "verify".
  const hasPendingTx = useSyncExternalStore(noop, () => !!loadPendingTx(id), () => false);
  useStatusToasts(batch);

  if (query.isLoading) return <DetailsSkeleton />;
  if (query.isError || !batch) {
    const notFound = isApiError(query.error) && query.error.kind === "notFound";
    return (
      <div>
        <BackLink />
        <Card>
          {notFound ? (
            <EmptyState
              icon={FileQuestion}
              title={t("notFoundTitle")}
              description={t("notFoundBody")}
              action={
                <Button asChild variant="outline">
                  <Link href="/batches">{t("back")}</Link>
                </Button>
              }
            />
          ) : (
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          )}
        </Card>
      </div>
    );
  }

  const showWallet = batch.channel === "trust_wallet" && (walletOpen || (hasPendingTx && batch.status !== "rejected"));

  return (
    <div className="animate-fade-up" data-testid="batch-details" data-status={batch.status}>
      <BackLink />
      <Header batch={batch} onStartTrustWallet={() => setWalletOpen(true)} />
      {showWallet && (
        <div className="mb-6">
          <TrustWalletFlow batch={batch} onClose={() => setWalletOpen(false)} />
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <BatchItems batch={batch} />
        <aside className="xl:sticky xl:top-24 xl:self-start">
          <AuditTimeline batchId={batch.id} processing={batch.status === "processing"} />
        </aside>
      </div>
    </div>
  );
}
