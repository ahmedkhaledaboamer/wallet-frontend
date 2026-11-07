"use client";

import { FlaskConical } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConfig } from "@/lib/api/queries";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

/** Always-visible environment warning. Defaults to TESTNET / DRY-RUN until /config says otherwise. */
export function TestnetBadge({ variant = "pill", className }: { variant?: "pill" | "strip"; className?: string }) {
  const t = useTranslations("env");
  const { data } = useConfig();
  const dryRun = data?.dryRun ?? true;
  const label = (
    <>
      <span>{t("testnet")}</span>
      {dryRun && (
        <>
          <span aria-hidden className="opacity-60">
            /
          </span>
          <span>{t("dryRun")}</span>
        </>
      )}
      {env.apiMode === "mock" && (
        <span className="ms-1 rounded-sm bg-testnet-fg/10 px-1 py-px text-[0.625rem] font-semibold tracking-wide">{t("mockMode")}</span>
      )}
    </>
  );

  if (variant === "strip") {
    return (
      <div
        role="status"
        data-testid="testnet-strip"
        className={cn(
          "flex items-center justify-center gap-1.5 border-b border-testnet-border/60 bg-testnet-bg px-4 py-1.5 text-xs font-semibold tracking-wide text-testnet-fg",
          className,
        )}
      >
        <FlaskConical className="size-3.5" aria-hidden />
        {label}
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="status"
          tabIndex={0}
          data-testid="testnet-badge"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-testnet-border bg-testnet-bg px-3 py-1 text-xs font-semibold tracking-wide text-testnet-fg",
            className,
          )}
        >
          <FlaskConical className="size-3.5" aria-hidden />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent>{dryRun ? t("tooltipDryRun") : t("tooltip")}</TooltipContent>
    </Tooltip>
  );
}
