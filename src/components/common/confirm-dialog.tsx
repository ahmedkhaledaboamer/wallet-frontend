"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InlineError } from "./states";

/**
 * Confirmation for every consequential action. The confirm button stays in a
 * pending state while the mutation runs; errors render inside the dialog.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  onConfirm,
  pending = false,
  error,
  tone = "default",
  confirmDisabled = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  error?: unknown;
  tone?: "default" | "destructive" | "brand";
  confirmDisabled?: boolean;
}) {
  const t = useTranslations("common");
  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-lg">{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        {error ? <InlineError error={error} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
          <Button
            onClick={onConfirm}
            disabled={pending || confirmDisabled}
            variant={tone === "destructive" ? "destructive" : tone === "brand" ? "brand" : "default"}
            className={cn(tone === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
            data-testid="confirm-action"
          >
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Key/value summary block used inside confirm dialogs. */
export function SummaryList({ items }: { items: { label: string; value: React.ReactNode; emphasis?: boolean }[] }) {
  return (
    <dl className="divide-y divide-border rounded-xl border border-border bg-muted/40">
      {items.map((it) => (
        <div key={it.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="text-sm text-muted-foreground">{it.label}</dt>
          <dd className={cn("text-end text-sm font-medium", it.emphasis && "text-lg font-semibold")}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
