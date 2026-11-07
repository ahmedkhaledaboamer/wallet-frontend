"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money } from "@/components/common/money";
import { formatCount } from "@/lib/amount";
import type { Issue, RowError, ValidationResult } from "@/lib/api/schemas";
import { ltr } from "@/lib/bidi";

/**
 * Translates a validation issue by its stable code (e.g. "reference.duplicate" → messages.issues.reference_duplicate).
 * Returns undefined for codes this UI doesn't know, so the caller falls back to the server's English message.
 */
export function useIssueText() {
  const t = useTranslations("issues");
  const tc = useTranslations("channel");
  return (issue: Issue): string | undefined => {
    const p = issue.params ?? {};
    let key = issue.code.replace(/\./g, "_");
    if (key === "amount_not_number" && (p.value === "" || p.value === undefined)) key = "amount_required";
    if (!t.has(key as never)) return undefined;
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(p)) {
      // User data (addresses, references, amounts) is isolated LTR so it can't flip an Arabic sentence.
      values[k] = k === "channel" && (v === "mexc" || v === "trust_wallet") ? tc(v) : ltr(Array.isArray(v) ? v.join(", ") : String(v));
    }
    return t(key as never, values as never);
  };
}

/** One line per issue: translated when the code is known, otherwise the server's (English) text. */
function rowMessages(e: RowError, issueText: (i: Issue) => string | undefined): { text: string; translated: boolean }[] {
  if (!e.issues.length) return e.messages.map((text) => ({ text, translated: false }));
  return e.issues.map((issue, i) => {
    const text = issueText(issue);
    return text ? { text, translated: true } : { text: e.messages[i] ?? issue.code, translated: false };
  });
}

export function ValidatingState({ fileName }: { fileName: string }) {
  const t = useTranslations("newPayout");
  return (
    <div role="status" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 shadow-card" data-testid="validating">
      <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
      <p className="text-sm font-medium">{t("validating", { file: fileName })}</p>
    </div>
  );
}

export function ValidSummary({ result }: { result: ValidationResult }) {
  const t = useTranslations("newPayout");
  const asset = result.asset ?? "USDT";
  const stats = [
    { label: t("summaryRows"), value: <span className="num">{formatCount(result.rowCount)}</span> },
    { label: t("summaryTotal"), value: <Money value={result.totalAmount} asset={asset} /> },
    { label: t("summaryAsset"), value: <span dir="ltr">{asset}</span> },
    { label: t("summaryNetwork"), value: <span dir="ltr">{result.network ?? "—"}</span> },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-status-succeeded-dot/30 bg-card shadow-card" data-testid="validation-valid">
      <div className="flex items-start gap-3 bg-status-succeeded-bg px-5 py-4 text-status-succeeded-fg">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">{t("validTitle")}</p>
          <p className="text-sm">{t("validBody")}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x rtl:sm:divide-x-reverse">
        {stats.map((s) => (
          <div key={s.label} className="px-5 py-4">
            <dt className="text-xs font-medium text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 font-heading text-lg font-bold">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ErrorsTable({ errors }: { errors: RowError[] }) {
  const t = useTranslations("newPayout");
  const issueText = useIssueText();
  const problems = errors.reduce((n, e) => n + Math.max(1, e.messages.length), 0);
  return (
    <div className="overflow-hidden rounded-2xl border border-status-failed-dot/30 bg-card shadow-card" data-testid="validation-errors">
      <div role="alert" className="flex items-start gap-3 bg-status-failed-bg px-5 py-4 text-status-failed-fg">
        <XCircle className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">{t("invalidTitle", { count: problems })}</p>
          <p className="text-sm">{t("invalidBody")}</p>
        </div>
      </div>
      <div className="max-h-[26rem] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-28 ps-5">{t("colRow")}</TableHead>
              <TableHead className="pe-5">{t("colMessages")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {errors.map((e) => (
              <TableRow key={e.row} data-testid={`error-row-${e.row}`}>
                <TableCell className="ps-5 align-top">
                  <span className="inline-flex min-w-10 justify-center rounded-md bg-muted px-2 py-0.5 text-xs font-semibold">
                    {e.row === 0 ? t("fileLevel") : <span className="num">{formatCount(e.row)}</span>}
                  </span>
                </TableCell>
                <TableCell className="pe-5 whitespace-normal">
                  <ul className="space-y-1">
                    {rowMessages(e, issueText).map((m, i) => (
                      <li key={i} className="flex gap-2 text-sm" dir={m.translated ? undefined : "auto"} data-testid="error-message">
                        <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-status-failed-dot" />
                        {m.text}
                      </li>
                    ))}
                  </ul>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
