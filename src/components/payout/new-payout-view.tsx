"use client";

import { ArrowRight, Download, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, InlineError, useErrorMessage } from "@/components/common/states";
import { api } from "@/lib/api";
import { isApiError } from "@/lib/api/errors";
import { useConfig, useCreateBatch, useDemoUsers, useValidateUpload } from "@/lib/api/queries";
import type { Channel, RowError, ValidationResult } from "@/lib/api/schemas";
import { useSession, useSessionActions } from "@/lib/session";
import { cn } from "@/lib/utils";
import { ChannelPicker } from "./channel-picker";
import { FileDropzone } from "./file-dropzone";
import { ErrorsTable, ValidSummary, ValidatingState } from "./validation-panel";

function Step({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <section className="grid gap-4 sm:grid-cols-[2.25rem_minmax(0,1fr)] sm:gap-5">
      <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:gap-2">
        <span
          aria-hidden
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
            done ? "bg-primary text-primary-foreground" : "border-2 border-border bg-card text-muted-foreground",
          )}
        >
          <span className="num">{n}</span>
        </span>
        <h2 className="font-heading text-base font-semibold sm:hidden">{title}</h2>
        <span aria-hidden className="hidden w-px flex-1 bg-border sm:block" />
      </div>
      <div className="min-w-0 pb-8">
        <h2 className="mb-4 hidden font-heading text-base font-semibold sm:block sm:pt-1.5">{title}</h2>
        {children}
      </div>
    </section>
  );
}

function MakerOnly() {
  const t = useTranslations();
  const session = useSession();
  const users = useDemoUsers();
  const { signIn } = useSessionActions();
  const maker = users.data?.find((u) => u.role === "maker");
  return (
    <Card>
      <EmptyState
        icon={Lock}
        title={t("newPayout.makerOnlyTitle")}
        description={t("newPayout.makerOnlyBody", { role: t(`roles.${session?.user.role ?? "maker"}`) })}
        action={
          maker ? (
            <Button onClick={() => signIn(maker)} data-testid="switch-to-maker">
              {t("newPayout.switchToMaker")}
            </Button>
          ) : undefined
        }
      />
    </Card>
  );
}

export function NewPayoutView() {
  const t = useTranslations();
  const router = useRouter();
  const session = useSession();
  const config = useConfig();
  const validate = useValidateUpload();
  const create = useCreateBatch();
  const errorMessage = useErrorMessage();

  const [channel, setChannel] = useState<Channel>();
  const [file, setFile] = useState<File>();
  const [result, setResult] = useState<ValidationResult>();
  const [createErrors, setCreateErrors] = useState<RowError[]>();
  const [downloading, setDownloading] = useState(false);
  const abortRef = useRef<AbortController>(undefined);
  const reqRef = useRef(0);

  /** Validates as soon as both a file and a channel are chosen; stale responses are ignored. */
  const revalidate = (f: File | undefined, c: Channel | undefined) => {
    abortRef.current?.abort();
    setResult(undefined);
    setCreateErrors(undefined);
    validate.reset();
    if (!f || !c) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const id = ++reqRef.current;
    validate.mutate(
      { file: f, channel: c, signal: ctrl.signal },
      { onSuccess: (r) => id === reqRef.current && setResult(r) },
    );
  };

  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const { blob, filename } = await api().downloadTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDownloading(false);
    }
  };

  const submit = () => {
    if (!file || !channel || !result?.valid) return;
    create.mutate(
      { file, channel },
      {
        onSuccess: (batch) => {
          toast.success(t("newPayout.created", { id: batch.id }));
          router.push(`/batches/${encodeURIComponent(batch.id)}`);
        },
        onError: (e) => {
          if (isApiError(e) && e.rowErrors.length) setCreateErrors(e.rowErrors);
        },
      },
    );
  };

  const header = (
    <PageHeader
      title={t("newPayout.title")}
      description={t("newPayout.subtitle")}
      actions={
        <Button variant="outline" onClick={downloadTemplate} disabled={downloading} data-testid="download-template">
          {downloading ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
          {downloading ? t("newPayout.downloadingTemplate") : t("newPayout.downloadTemplate")}
        </Button>
      }
    />
  );

  if (session && session.user.role !== "maker") {
    return (
      <div className="animate-fade-up">
        {header}
        <MakerOnly />
      </div>
    );
  }

  const errors = createErrors ?? (result && !result.valid ? result.errors : undefined);
  const validating = validate.isPending;
  const canSubmit = Boolean(result?.valid && !createErrors && !create.isPending);

  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      {header}

      <Step n={1} title={t("newPayout.stepChannel")} done={!!channel}>
        <ChannelPicker
          value={channel}
          onChange={(c) => {
            setChannel(c);
            revalidate(file, c);
          }}
        />
      </Step>

      <Step n={2} title={t("newPayout.stepFile")} done={!!file}>
        <FileDropzone
          file={file}
          onFile={(f) => {
            setFile(f);
            revalidate(f, channel);
          }}
          maxRows={(channel && config.data?.maxRowsByChannel?.[channel]) || config.data?.maxRows}
          maxTotal={config.data?.maxBatchTotal}
          disabled={create.isPending}
        />
      </Step>

      <Step n={3} title={t("newPayout.stepReview")} done={canSubmit}>
        <div className="space-y-4" aria-live="polite">
          {!file || !channel ? (
            <p className="rounded-2xl border border-dashed border-border px-5 py-6 text-sm text-muted-foreground">
              {!channel ? t("newPayout.chooseChannelFirst") : t("newPayout.dropTitle")}
            </p>
          ) : validating ? (
            <ValidatingState fileName={file.name} />
          ) : validate.isError && !(validate.error instanceof DOMException) ? (
            <InlineError error={validate.error} />
          ) : errors ? (
            <ErrorsTable errors={errors} />
          ) : result?.valid ? (
            <ValidSummary result={result} />
          ) : null}

          {validate.isError && !(validate.error instanceof DOMException) && (
            <Button variant="outline" size="sm" onClick={() => revalidate(file, channel)}>
              {t("common.retry")}
            </Button>
          )}
          {create.isError && !createErrors && <InlineError error={create.error} />}

          <div className="flex justify-end pt-2">
            <Button size="lg" onClick={submit} disabled={!canSubmit} data-testid="submit-batch" className="min-w-44">
              {create.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {create.isPending ? t("newPayout.submitting") : t("newPayout.submit")}
              {!create.isPending && <ArrowRight className="rtl:rotate-180" aria-hidden />}
            </Button>
          </div>
        </div>
      </Step>
    </div>
  );
}
