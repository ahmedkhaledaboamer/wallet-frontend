"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { BatchStatus, ItemStatus } from "@/lib/api/schemas";

type AnyStatus = BatchStatus | ItemStatus;
type Tone = "pending" | "processing" | "succeeded" | "failed" | "reconciliation" | "draft" | "approved";

const TONE: Record<AnyStatus, Tone> = {
  draft: "draft",
  approved: "approved",
  rejected: "failed",
  processing: "processing",
  completed: "succeeded",
  completed_with_issues: "reconciliation",
  failed: "failed",
  pending: "pending",
  succeeded: "succeeded",
  requires_reconciliation: "reconciliation",
};

// Literal class names so Tailwind can see them.
const TONE_CLASS: Record<Tone, { badge: string; dot: string }> = {
  pending: { badge: "bg-status-pending-bg text-status-pending-fg", dot: "bg-status-pending-dot" },
  processing: { badge: "bg-status-processing-bg text-status-processing-fg", dot: "bg-status-processing-dot" },
  succeeded: { badge: "bg-status-succeeded-bg text-status-succeeded-fg", dot: "bg-status-succeeded-dot" },
  failed: { badge: "bg-status-failed-bg text-status-failed-fg", dot: "bg-status-failed-dot" },
  reconciliation: { badge: "bg-status-reconciliation-bg text-status-reconciliation-fg", dot: "bg-status-reconciliation-dot" },
  draft: { badge: "bg-status-draft-bg text-status-draft-fg", dot: "bg-status-draft-dot" },
  approved: { badge: "bg-status-approved-bg text-status-approved-fg", dot: "bg-status-approved-dot" },
};

export function statusTone(status: AnyStatus): Tone {
  return TONE[status];
}

export function StatusBadge({ status, size = "sm", className }: { status: AnyStatus; size?: "sm" | "lg"; className?: string }) {
  const t = useTranslations("status");
  const tone = TONE_CLASS[TONE[status]];
  const live = status === "processing";
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap",
        size === "lg" ? "px-3 py-1 text-sm" : "px-2.5 py-0.5 text-xs",
        tone.badge,
        className,
      )}
    >
      <span aria-hidden className="relative flex size-1.5">
        {live && <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-75", tone.dot)} />}
        <span className={cn("relative inline-flex size-1.5 rounded-full", tone.dot)} />
      </span>
      {t(status)}
    </span>
  );
}
