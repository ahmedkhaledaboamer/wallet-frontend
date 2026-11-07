"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/amount";
import { ltr } from "@/lib/bidi";
import { cn } from "@/lib/utils";
import type { PageMeta } from "@/lib/api/schemas";

export function Pagination({ meta, onPageChange, className }: { meta: PageMeta; onPageChange: (page: number) => void; className?: string }) {
  const t = useTranslations("pagination");
  const pages = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  if (meta.total === 0) return null;
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.total, meta.page * meta.pageSize);

  return (
    <nav aria-label={t("label")} className={cn("flex items-center justify-between gap-3 text-sm", className)}>
      <p className="text-muted-foreground" aria-live="polite">
        <span className="tabular-nums">{t("showing", { range: ltr(`${formatCount(from)}–${formatCount(to)}`), total: formatCount(meta.total) })}</span>
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(meta.page - 1)}
            disabled={meta.page <= 1}
            aria-label={t("previous")}
          >
            <ChevronLeft className="rtl:rotate-180" aria-hidden />
          </Button>
          <span className="min-w-16 text-center text-muted-foreground tabular-nums">
            {t("page", { page: formatCount(meta.page), pages: formatCount(pages) })}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(meta.page + 1)}
            disabled={meta.page >= pages}
            aria-label={t("next")}
          >
            <ChevronRight className="rtl:rotate-180" aria-hidden />
          </Button>
        </div>
      )}
    </nav>
  );
}
