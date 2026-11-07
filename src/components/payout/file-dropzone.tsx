"use client";

import { FileSpreadsheet, RefreshCw, UploadCloud, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatAmount, formatCount } from "@/lib/amount";
import { cn } from "@/lib/utils";

function fileSize(bytes: number) {
  if (bytes < 1024) return `${formatCount(bytes)} B`;
  if (bytes < 1024 * 1024) return `${formatAmount(String(Math.round(bytes / 102.4) / 10), { minFraction: 0 })} KB`;
  return `${formatAmount(String(Math.round(bytes / 104857.6) / 10), { minFraction: 0 })} MB`;
}

const isXlsx = (f: File) => /\.xlsx$/i.test(f.name);

export function FileDropzone({
  file,
  onFile,
  maxRows,
  maxTotal,
  disabled,
}: {
  file?: File;
  onFile: (f: File | undefined) => void;
  maxRows?: number;
  maxTotal?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("newPayout");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [typeError, setTypeError] = useState(false);
  const hintId = useId();

  const accept = (f: File | undefined) => {
    if (!f) return;
    if (!isXlsx(f)) {
      setTypeError(true);
      return;
    }
    setTypeError(false);
    onFile(f);
  };

  if (file) {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-card" data-testid="selected-file">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-status-succeeded-bg text-status-succeeded-fg">
          <FileSpreadsheet className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" dir="auto">
            {file.name}
          </p>
          <p className="num text-xs text-muted-foreground">{fileSize(file.size)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled}>
            <RefreshCw aria-hidden />
            {t("replaceFile")}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => onFile(undefined)} aria-label={t("removeFile")} disabled={disabled}>
            <X aria-hidden />
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = "";
          }}
          data-testid="file-input"
        />
      </div>
    );
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) accept(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all",
          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
          dragging ? "border-primary bg-secondary" : "border-input bg-card hover:border-primary/50 hover:bg-secondary/40",
          disabled && "pointer-events-none opacity-60",
        )}
        data-testid="dropzone"
      >
        <span
          className={cn(
            "flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary transition-transform",
            dragging ? "scale-110" : "group-hover:-translate-y-0.5",
          )}
        >
          <UploadCloud className="size-7" aria-hidden />
        </span>
        <span className="font-heading text-base font-semibold">{dragging ? t("dropActive") : t("dropTitle")}</span>
        <span className="text-sm text-muted-foreground">
          {t("dropOr")} <span className="font-semibold text-link underline-offset-4 group-hover:underline">{t("browse")}</span>
        </span>
        {maxRows !== undefined && maxTotal !== undefined && (
          <span id={hintId} className="text-xs text-muted-foreground">
            {t.rich("dropHint", {
              maxRows: formatCount(maxRows),
              maxTotal: formatAmount(maxTotal, { minFraction: 0 }) + " USDT",
            })}
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          aria-describedby={hintId}
          disabled={disabled}
          onChange={(e) => {
            accept(e.target.files?.[0]);
            e.target.value = "";
          }}
          data-testid="file-input"
        />
      </label>
      {typeError && (
        <p role="alert" className="mt-2 text-sm font-medium text-destructive">
          {t("wrongType")}
        </p>
      )}
    </div>
  );
}
