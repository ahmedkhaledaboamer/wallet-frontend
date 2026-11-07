"use client";

import { AlertTriangle, RotateCw, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { errorKind, isApiError } from "@/lib/api/errors";

export function useErrorMessage() {
  const t = useTranslations("errors");
  return (error: unknown) => t(errorKind(error));
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-2 py-10" : "gap-3 py-16", className)}>
      {Icon && (
        <div className="relative mb-1 flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
          <span aria-hidden className="absolute inset-0 rounded-2xl bg-brand-gradient opacity-10" />
          <Icon className="size-6" aria-hidden />
        </div>
      )}
      <p className="font-heading text-base font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
  compact = false,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations();
  const message = useErrorMessage()(error);
  const detail = isApiError(error) && error.kind === "validation" ? error.message : undefined;
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center gap-3 text-center", compact ? "py-8" : "py-14", className)}
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-status-failed-bg text-status-failed-fg">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="font-heading font-semibold">{t("errors.title")}</p>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
        {detail && <p className="max-w-md text-sm text-muted-foreground">{detail}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw aria-hidden />
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

/** Inline error for forms / dialogs. */
export function InlineError({ error, className }: { error: unknown; className?: string }) {
  const message = useErrorMessage()(error);
  const detail = isApiError(error) && error.kind === "validation" ? error.message : undefined;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-lg bg-status-failed-bg px-3 py-2.5 text-sm text-status-failed-fg",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">{message}</p>
        {detail && <p className="mt-0.5 opacity-90">{detail}</p>}
      </div>
    </div>
  );
}
