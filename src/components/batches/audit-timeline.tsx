"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  FilePlus2,
  Rocket,
  Send,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/states";
import { useBatchAudit } from "@/lib/api/queries";
import type { AuditEntry } from "@/lib/api/schemas";
import { cn } from "@/lib/utils";
import { AuditContext, useActionLabel } from "@/components/audit/audit-format";

const ICON: Record<string, { icon: LucideIcon; tone: string }> = {
  "batch.created": { icon: FilePlus2, tone: "bg-status-draft-bg text-status-draft-fg" },
  "batch.approved": { icon: ShieldCheck, tone: "bg-status-approved-bg text-status-approved-fg" },
  "batch.rejected": { icon: XCircle, tone: "bg-status-failed-bg text-status-failed-fg" },
  "batch.execution_started": { icon: Rocket, tone: "bg-status-processing-bg text-status-processing-fg" },
  "batch.transaction_submitted": { icon: Send, tone: "bg-status-processing-bg text-status-processing-fg" },
  "batch.completed": { icon: CheckCircle2, tone: "bg-status-succeeded-bg text-status-succeeded-fg" },
  "batch.completed_with_issues": { icon: AlertTriangle, tone: "bg-status-reconciliation-bg text-status-reconciliation-fg" },
  "batch.failed": { icon: XCircle, tone: "bg-status-failed-bg text-status-failed-fg" },
  "item.failed": { icon: XCircle, tone: "bg-status-failed-bg text-status-failed-fg" },
  "item.requires_reconciliation": { icon: AlertTriangle, tone: "bg-status-reconciliation-bg text-status-reconciliation-fg" },
};

function Entry({ entry, last }: { entry: AuditEntry; last: boolean }) {
  const t = useTranslations("batch.audit");
  const format = useFormatter();
  const label = useActionLabel();
  const { icon: Icon, tone } = ICON[entry.action] ?? { icon: CircleDot, tone: "bg-muted text-muted-foreground" };
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && <span aria-hidden className="absolute start-4 top-9 bottom-0 w-px -translate-x-1/2 bg-border rtl:translate-x-1/2" />}
      <span className={cn("relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full", tone)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold">{label(entry.action)}</p>
        <p className="text-xs text-muted-foreground">
          {entry.actor?.name ?? t("system")} ·{" "}
          <time dateTime={entry.createdAt} className="tabular-nums">
            {format.dateTime(new Date(entry.createdAt), { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </p>
        <AuditContext context={entry.context} className="mt-1.5" />
      </div>
    </li>
  );
}

export function AuditTimeline({ batchId, processing }: { batchId: string; processing: boolean }) {
  const t = useTranslations("batch.audit");
  const query = useBatchAudit(batchId, processing);
  const entries = query.data ? [...query.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : undefined;

  return (
    <Card data-testid="audit-timeline">
      <CardHeader>
        <CardTitle className="text-lg">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} compact />
        ) : !entries ? (
          <div className="space-y-4" aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <ol className="max-h-[36rem] overflow-y-auto pe-1">
            {entries.map((e, i) => (
              <Entry key={e.id} entry={e} last={i === entries.length - 1} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
