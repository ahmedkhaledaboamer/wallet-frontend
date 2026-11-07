"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Info, Rocket, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WalletIcon } from "@/components/common/channel";
import { ConfirmDialog, SummaryList } from "@/components/common/confirm-dialog";
import { Count, Money } from "@/components/common/money";
import { useErrorMessage } from "@/components/common/states";
import type { Messages } from "@/i18n/config";
import { formatAmount } from "@/lib/amount";
import { ltr } from "@/lib/bidi";
import { isApiError } from "@/lib/api/errors";
import { useApproveBatch, useExecuteBatch, useRefreshBatch, useRejectBatch } from "@/lib/api/queries";
import type { Batch } from "@/lib/api/schemas";
import { useSession } from "@/lib/session";

type DialogKind ="approve" | "reject" | "pay" | "payTrust" | null;

function useBatchSummary(batch: Batch) {
  const t = useTranslations();
  return [
    { label: t("batch.actions.summaryTotal"), value: <Money value={batch.totalAmount} asset={batch.asset} />, emphasis: true },
    { label: t("batch.actions.summaryCount"), value: <Count value={batch.itemCount} /> },
    { label: t("batch.actions.summaryNetwork"), value: <span dir="ltr">{batch.network}</span> },
    { label: t("batch.actions.summaryChannel"), value: t(`channel.${batch.channel}`) },
  ];
}

const rejectSchema = z.object({ reason: z.string().trim().min(5) });

export function BatchActions({ batch, onStartTrustWallet }: { batch: Batch; onStartTrustWallet: () => void }) {
  const t = useTranslations();
  const session = useSession();
  const role = session?.user.role;
  const [dialog, setDialog] = useState<DialogKind>(null);
  const approve = useApproveBatch(batch.id);
  const reject = useRejectBatch(batch.id);
  const execute = useExecuteBatch(batch.id);
  const refresh = useRefreshBatch();
  const errorMessage = useErrorMessage();
  const summary = useBatchSummary(batch);
  const form = useForm<z.infer<typeof rejectSchema>>({ resolver: zodResolver(rejectSchema), defaultValues: { reason: "" } });

  const close = () => {
    setDialog(null);
    approve.reset();
    reject.reset();
    execute.reset();
    form.reset();
  };

  /** 409 = someone else already moved this batch on: close, explain, refetch. */
  const onError = (e: unknown) => {
    if (isApiError(e) && (e.kind === "conflict" || e.kind === "forbidden")) {
      toast.error(errorMessage(e));
      close();
      void refresh(batch.id);
    }
  };

  const amountText = ltr(`${formatAmount(batch.totalAmount)} ${batch.asset}`);

  const canApprove = role === "checker" && batch.status === "draft";
  const canPayMexc = role === "executor" && batch.status === "approved" && batch.channel === "mexc";
  const canPayTrust = role === "executor" && batch.status === "approved" && batch.channel === "trust_wallet";

  const nextKey =
    batch.status === "approved" && batch.channel === "trust_wallet" ? "approvedTrust" : (batch.status as keyof Messages["batch"]["next"]);

  return (
    <div className="flex flex-col gap-3" role="group" aria-label={t("batch.actions.label")} data-testid="batch-actions">
      {canApprove && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" onClick={() => setDialog("reject")} className="text-destructive hover:text-destructive" data-testid="reject-batch">
            <X aria-hidden />
            {t("batch.actions.reject")}
          </Button>
          <Button size="lg" onClick={() => setDialog("approve")} data-testid="approve-batch">
            <Check aria-hidden />
            {t("batch.actions.approve")}
          </Button>
        </div>
      )}
      {canPayMexc && (
        <Button variant="brand" size="xl" onClick={() => setDialog("pay")} data-testid="pay-all">
          <Rocket aria-hidden />
          {t("batch.actions.payAll")}
        </Button>
      )}
      {canPayTrust && (
        <Button variant="brand" size="xl" onClick={() => setDialog("payTrust")} data-testid="pay-trust">
          <WalletIcon className="size-5" />
          {t("batch.actions.payTrust")}
        </Button>
      )}
      {!canApprove && !canPayMexc && !canPayTrust && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground" data-testid="next-step">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t(`batch.next.${nextKey}`)}
        </p>
      )}

      <ConfirmDialog
        open={dialog === "approve"}
        onOpenChange={(o) => !o && close()}
        title={t("batch.actions.approveTitle")}
        description={t("batch.actions.approveBody")}
        confirmLabel={t("batch.actions.approveConfirm")}
        pending={approve.isPending}
        error={approve.error}
        onConfirm={() =>
          approve.mutate(undefined, {
            onSuccess: () => {
              toast.success(t("batch.actions.approved", { id: batch.id }));
              close();
            },
            onError,
          })
        }
      >
        <SummaryList items={summary} />
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "reject"}
        onOpenChange={(o) => !o && close()}
        title={t("batch.actions.rejectTitle")}
        description={t("batch.actions.rejectBody")}
        confirmLabel={t("batch.actions.rejectConfirm")}
        tone="destructive"
        pending={reject.isPending}
        error={reject.error}
        onConfirm={form.handleSubmit(({ reason }) =>
          reject.mutate(reason, {
            onSuccess: () => {
              toast.success(t("batch.actions.rejected", { id: batch.id }));
              close();
            },
            onError,
          }),
        )}
      >
        <div className="grid gap-2">
          <Label htmlFor="reject-reason">{t("batch.actions.rejectReason")}</Label>
          <Textarea
            id="reject-reason"
            rows={3}
            placeholder={t("batch.actions.rejectPlaceholder")}
            aria-invalid={!!form.formState.errors.reason}
            aria-describedby={form.formState.errors.reason ? "reject-reason-error" : undefined}
            {...form.register("reason")}
            data-testid="reject-reason"
          />
          {form.formState.errors.reason && (
            <p id="reject-reason-error" className="text-sm text-destructive">
              {t("batch.actions.rejectTooShort")}
            </p>
          )}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "pay"}
        onOpenChange={(o) => !o && close()}
        title={t("batch.actions.payTitle")}
        description={t("batch.actions.payBody")}
        confirmLabel={t("batch.actions.payConfirm", { amount: amountText })}
        tone="brand"
        pending={execute.isPending}
        error={execute.error}
        onConfirm={() =>
          execute.mutate(undefined, {
            onSuccess: () => {
              toast.success(t("batch.actions.payStarted"));
              close();
            },
            onError,
          })
        }
      >
        <SummaryList items={summary} />
        <p className="text-xs text-muted-foreground">{t("batch.actions.irreversible")}</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "payTrust"}
        onOpenChange={(o) => !o && close()}
        title={t("batch.actions.payTrustTitle")}
        description={t("batch.actions.payTrustBody")}
        confirmLabel={t("batch.actions.payTrustConfirm")}
        tone="brand"
        onConfirm={() => {
          close();
          onStartTrustWallet();
        }}
      >
        <SummaryList items={summary} />
        <p className="text-xs text-muted-foreground">{t("batch.actions.irreversible")}</p>
      </ConfirmDialog>
    </div>
  );
}
