"use client";

import { AlertTriangle, ArrowRight, Hourglass, Loader, Plus, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BatchesTable } from "@/components/batches/batches-table";
import { ChannelIcon } from "@/components/common/channel";
import { Count, Money } from "@/components/common/money";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState } from "@/components/common/states";
import { formatCount, sharePercent } from "@/lib/amount";
import { useBatches, useDashboardStats } from "@/lib/api/queries";
import type { DashboardStats } from "@/lib/api/schemas";
import { useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

function KpiCard({
  label,
  hint,
  icon: Icon,
  children,
  href,
  tone,
  testId,
}: {
  label: string;
  hint: string;
  icon: LucideIcon;
  children: React.ReactNode;
  href?: string;
  tone: "brand" | "approved" | "processing" | "reconciliation";
  testId: string;
}) {
  const toneClass = {
    brand: "bg-secondary text-primary",
    approved: "bg-status-approved-bg text-status-approved-fg",
    processing: "bg-status-processing-bg text-status-processing-fg",
    reconciliation: "bg-status-reconciliation-bg text-status-reconciliation-fg",
  }[tone];
  const body = (
    <Card
      className={cn(
        "h-full gap-4 transition-all",
        href && "group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-raised",
      )}
      data-testid={testId}
    >
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span className={cn("flex size-9 items-center justify-center rounded-xl", toneClass)}>
            <Icon className="size-[1.125rem]" aria-hidden />
          </span>
        </div>
        <div className="font-heading text-[1.75rem] leading-none font-bold tracking-tight">{children}</div>
        <p className="mt-auto text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="group block rounded-xl">
      {body}
    </Link>
  ) : (
    body
  );
}

function KpiSkeleton() {
  return <Skeleton className="h-[9.5rem] w-full rounded-xl" />;
}

function ChannelTotals({ stats }: { stats: DashboardStats }) {
  const t = useTranslations();
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">{t("dashboard.byChannel")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {stats.byChannel.map((c) => {
          const pct = sharePercent(c.totalPaid, stats.totalPaid);
          return (
            <div key={c.channel} className="space-y-2.5" data-testid={`channel-total-${c.channel}`}>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <span className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                    <ChannelIcon channel={c.channel} className="size-5" />
                  </span>
                  <span>
                    <span className="block font-semibold">{t(`channel.${c.channel}Short`)}</span>
                    <span className="text-xs text-muted-foreground">{t("common.batches", { count: c.batchCount })}</span>
                  </span>
                </span>
                <Money value={c.totalPaid} asset="USDT" maxFraction={2} className="text-base font-semibold" />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className={cn("h-full rounded-full transition-[width] duration-700", c.channel === "mexc" ? "bg-chart-1" : "bg-chart-5")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="num text-xs text-muted-foreground">{t("dashboard.shareOfTotal", { percent: formatCount(pct) })}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const t = useTranslations();
  const session = useSession();
  const stats = useDashboardStats();
  const recent = useBatches({ page: 1, pageSize: 6 });
  const isMaker = session?.user.role === "maker";

  const newPayout = isMaker ? (
    <Button asChild size="lg">
      <Link href="/payouts/new">
        <Plus aria-hidden />
        {t("nav.newPayout")}
      </Link>
    </Button>
  ) : null;

  return (
    <div className="animate-fade-up">
      <PageHeader title={t("dashboard.title")} description={t("dashboard.subtitle")} actions={newPayout} />

      {stats.isError ? (
        <Card className="mb-6">
          <ErrorState error={stats.error} onRetry={() => void stats.refetch()} compact />
        </Card>
      ) : (
        <section aria-label={t("dashboard.title")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.data ? (
            <>
              {/* Hero KPI: the only place the decorative logo gradient frames a figure. */}
              <div className="relative rounded-xl bg-brand-gradient p-px shadow-glow">
                <div className="h-full rounded-[calc(var(--radius)-1px)] bg-card">
                  <KpiCard label={t("dashboard.totalPaid")} hint={t("dashboard.totalPaidHint")} icon={Sparkles} tone="brand" testId="kpi-total-paid">
                    <Money value={stats.data.totalPaid} asset="USDT" maxFraction={2} />
                  </KpiCard>
                </div>
              </div>
              <KpiCard
                label={t("dashboard.pendingApproval")}
                hint={t("dashboard.pendingApprovalHint")}
                icon={Hourglass}
                tone="approved"
                href="/batches?status=draft"
                testId="kpi-pending"
              >
                <Count value={stats.data.pendingApprovalCount} />
              </KpiCard>
              <KpiCard
                label={t("dashboard.processing")}
                hint={t("dashboard.processingHint")}
                icon={Loader}
                tone="processing"
                href="/batches?status=processing"
                testId="kpi-processing"
              >
                <Count value={stats.data.processingCount} />
              </KpiCard>
              <KpiCard
                label={t("dashboard.needsReconciliation")}
                hint={t("dashboard.needsReconciliationHint")}
                icon={AlertTriangle}
                tone="reconciliation"
                href="/batches?status=completed_with_issues"
                testId="kpi-reconciliation"
              >
                <Count value={stats.data.needsReconciliationCount} />
              </KpiCard>
            </>
          ) : (
            Array.from({ length: 4 }, (_, i) => <KpiSkeleton key={i} />)
          )}
        </section>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="order-2 gap-0 pb-0 xl:order-1">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{t("dashboard.recent")}</CardTitle>
            <CardAction>
              <Button asChild variant="link" className="h-auto px-0">
                <Link href="/batches">
                  {t("common.viewAll")}
                  <ArrowRight className="rtl:rotate-180" aria-hidden />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <div className="border-t border-border">
            {recent.isError ? (
              <ErrorState error={recent.error} onRetry={() => void recent.refetch()} compact />
            ) : recent.data && recent.data.data.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title={t("dashboard.emptyTitle")}
                description={t("dashboard.emptyBody")}
                action={
                  isMaker ? (
                    <Button asChild>
                      <Link href="/payouts/new">{t("dashboard.emptyCta")}</Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <BatchesTable batches={recent.data?.data} loading={recent.isLoading} skeletonRows={5} compact />
            )}
          </div>
        </Card>
        <div className="order-1 xl:order-2">
          {stats.data ? <ChannelTotals stats={stats.data} /> : !stats.isError && <Skeleton className="h-72 w-full rounded-xl" />}
        </div>
      </div>
    </div>
  );
}
