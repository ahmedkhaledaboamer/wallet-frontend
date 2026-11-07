"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { safeHref, truncateMiddle } from "@/lib/explorer";

export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the full value is still selectable in the tooltip */
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={copy}
          aria-label={t("copyValue", { label })}
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            className,
          )}
        >
          {copied ? <Check className="size-3.5 text-status-succeeded-fg" /> : <Copy className="size-3.5" />}
        </button>
      </TooltipTrigger>
      <TooltipContent>{copied ? t("copied") : t("copy")}</TooltipContent>
    </Tooltip>
  );
}

export function ExplorerLink({ href, className }: { href?: string; className?: string }) {
  const t = useTranslations("common");
  const safe = safeHref(href);
  if (!safe) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={safe}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("openExplorer")}
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-link transition-colors hover:bg-muted hover:text-link-hover",
            className,
          )}
        >
          <ExternalLink className="size-3.5" />
        </a>
      </TooltipTrigger>
      <TooltipContent>{t("openExplorer")}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Address or hash: truncated, LTR, monospaced-ish, with copy + explorer actions.
 * The full value is exposed via `title` and the copy button.
 */
export function HashValue({
  value,
  href,
  kind = "address",
  head = 6,
  tail = 4,
  full = false,
  className,
}: {
  value: string;
  href?: string;
  kind?: "address" | "txHash";
  head?: number;
  tail?: number;
  full?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-0.5", className)}>
      <span
        dir="ltr"
        title={value}
        className={cn("num font-mono text-[0.8125rem] text-foreground", full ? "break-all" : "whitespace-nowrap")}
      >
        {full ? value : truncateMiddle(value, head, tail)}
      </span>
      <CopyButton value={value} label={t(kind)} />
      <ExplorerLink href={href} />
    </span>
  );
}
