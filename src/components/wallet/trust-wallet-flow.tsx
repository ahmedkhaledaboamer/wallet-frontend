"use client";

import { AlertTriangle, Check, CheckCircle2, Loader2, QrCode, RotateCcw, Smartphone, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HashValue } from "@/components/common/address";
import { WalletIcon } from "@/components/common/channel";
import { Money } from "@/components/common/money";
import { formatAmount, formatCount, fromUnits } from "@/lib/amount";
import { useConfig } from "@/lib/api/queries";
import type { Batch } from "@/lib/api/schemas";
import { isWalletConnectEnabled } from "@/lib/env";
import { addressUrl, txUrl } from "@/lib/explorer";
import { cn } from "@/lib/utils";
import { STEPS, stepStates, type StepId, type StepState } from "@/lib/wallet/machine";
import { useTrustWalletFlow } from "@/lib/wallet/use-trust-wallet-flow";

function StepIcon({ state, index }: { state: StepState; index: number }) {
  const base = "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors";
  if (state === "complete") return <span className={cn(base, "bg-status-succeeded-dot text-primary-foreground")}><Check className="size-4" aria-hidden /></span>;
  if (state === "skipped") return <span className={cn(base, "bg-status-succeeded-bg text-status-succeeded-fg")}><Check className="size-4" aria-hidden /></span>;
  if (state === "error") return <span className={cn(base, "bg-status-failed-dot text-primary-foreground")}><X className="size-4" aria-hidden /></span>;
  if (state === "current")
    return (
      <span className={cn(base, "bg-primary text-primary-foreground ring-4 ring-secondary")}>
        <Loader2 className="size-4 animate-spin" aria-hidden />
      </span>
    );
  return <span className={cn(base, "border-2 border-border bg-card text-muted-foreground")}><span className="num">{index + 1}</span></span>;
}

export function TrustWalletFlow({ batch, onClose }: { batch: Batch; onClose: () => void }) {
  const t = useTranslations("wallet");
  const tc = useTranslations("common");
  const config = useConfig();
  const flow = useTrustWalletFlow(batch);
  const { state, prepared } = flow;
  const states = stepStates(state);
  const netName = config.data?.networks.find((n) => n.network === batch.network)?.name ?? batch.network;
  const totalText = `${formatAmount(batch.totalAmount)} ${batch.asset}`;
  const busy = state.status === "running" || state.status === "waitingWallet";
  const canClose = !busy && !state.txHash;

  const hint = (s: StepId): string => {
    switch (s) {
      case "network":
        return t("stepHint.network", { network: netName, amount: totalText });
      case "approve":
        return state.approveSkipped ? t("stepHint.approveSkipped", { amount: totalText }) : t("stepHint.approve", { amount: totalText });
      default:
        return t(`stepHint.${s}`);
    }
  };

  const errorText = (() => {
    const e = state.error;
    if (!e) return null;
    const p = e.params ?? {};
    switch (e.code) {
      case "wrongAccount":
        return t("errors.wrongAccount", { account: p.account ?? "?", treasury: p.treasury ?? "?" });
      case "wrongNetwork":
      case "switchFailed":
        return t(`errors.${e.code}`, { network: p.network ?? netName });
      case "insufficientBalance":
        return t("errors.insufficientBalance", { balance: p.balance ?? "?", required: p.required ?? totalText });
      case "simulationFailed":
        return t("errors.simulationFailed", { reason: p.reason ?? "" });
      case "unknown":
        return t("errors.unknown", { message: p.message ?? "" });
      default:
        return t(`errors.${e.code}`);
    }
  })();

  const decimals = prepared?.payload.tokenDecimals;
  const units = (v?: string) => (v === undefined || decimals === undefined ? undefined : fromUnits(BigInt(v), decimals));

  return (
    <Card className="overflow-visible border-primary/30 shadow-raised" data-testid="trust-wallet-flow" aria-live="polite">
      <CardHeader className="border-b border-border">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-gradient-strong text-primary-foreground">
            <WalletIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg">{t("title")}</CardTitle>
            <CardDescription>{t("subtitle", { count: formatCount(batch.itemCount), network: netName })}</CardDescription>
          </div>
          {canClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={tc("close")}>
              <X aria-hidden />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="grid gap-8 pt-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        {/* Vertical stepper */}
        <ol className="space-y-0" aria-label={t("title")}>
          {STEPS.map((s, i) => {
            const st = states[s];
            const last = i === STEPS.length - 1;
            const active = st === "current" || st === "error";
            return (
              <li key={s} className="relative flex gap-4 pb-6 last:pb-0" data-testid={`wallet-step-${s}`} data-state={st} aria-current={active ? "step" : undefined}>
                {!last && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute start-4 top-9 bottom-1 w-0.5 -translate-x-1/2 rounded-full rtl:translate-x-1/2",
                      st === "complete" || st === "skipped" ? "bg-status-succeeded-dot" : "bg-border",
                    )}
                  />
                )}
                <StepIcon state={st} index={i} />
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn("text-sm font-semibold", st === "pending" && "text-muted-foreground")}>{t(`steps.${s}`)}</p>
                    {st === "skipped" && (
                      <span className="rounded-md bg-status-succeeded-bg px-1.5 py-0.5 text-[0.6875rem] font-semibold text-status-succeeded-fg">
                        {t("status.skipped")}
                      </span>
                    )}
                    {st === "current" && state.status === "waitingWallet" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-status-processing-bg px-1.5 py-0.5 text-[0.6875rem] font-semibold text-status-processing-fg">
                        <Smartphone className="size-3" aria-hidden />
                        {t("status.waitingWallet")}
                      </span>
                    )}
                  </div>
                  {(active || st === "skipped" || (s === "connect" && state.status === "idle")) && (
                    <p className="mt-1 text-sm text-muted-foreground">{hint(s)}</p>
                  )}

                  {/* Start controls */}
                  {s === "connect" && state.status === "idle" && (
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => flow.start("injected")} disabled={!flow.injected} data-testid="wallet-connect-injected">
                          <WalletIcon className="size-4" />
                          {t("connectTrust")}
                        </Button>
                        {isWalletConnectEnabled && (
                          <Button variant="outline" onClick={() => flow.start("walletconnect")} data-testid="wallet-connect-qr">
                            <QrCode aria-hidden />
                            {t("connectQr")}
                          </Button>
                        )}
                      </div>
                      {!flow.injected && (
                        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                          {t("noWallet")} {t("noWalletHint")}
                        </p>
                      )}
                      {flow.injected === "injected" && <p className="text-xs text-muted-foreground">{t("otherWallet")}</p>}
                      {!isWalletConnectEnabled && <p className="text-xs text-muted-foreground" data-testid="qr-unavailable">{t("qrUnavailable")}</p>}
                    </div>
                  )}

                  {/* Errors */}
                  {st === "error" && errorText && (
                    <div role="alert" className="mt-3 rounded-xl bg-status-failed-bg p-3 text-sm text-status-failed-fg" data-testid="wallet-error" data-code={state.error?.code}>
                      <p className="flex items-start gap-2 font-medium">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                        <span>{errorText}</span>
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" onClick={flow.retry} data-testid="wallet-retry">
                          <RotateCcw aria-hidden />
                          {state.error?.code === "backend" ? t("retryReport") : t("retry")}
                        </Button>
                        {!state.txHash && (
                          <Button size="sm" variant="outline" onClick={flow.reset}>
                            {t("restart")}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {s === "done" && state.status === "done" && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl bg-status-succeeded-bg p-3 text-sm text-status-succeeded-fg" data-testid="wallet-done">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <div>
                        <p className="font-semibold">{t("doneTitle")}</p>
                        <p>{state.finalStatus === "completed" ? t("doneBody") : t("issuesBody")}</p>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {/* Facts panel */}
        <dl className="h-fit space-y-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">{t("required")}</dt>
            <dd className="mt-0.5 font-heading text-lg font-bold">
              <Money value={batch.totalAmount} asset={batch.asset} />
            </dd>
          </div>
          {state.account && (
            <div>
              <dt className="text-xs text-muted-foreground">{t("connectedAs")}</dt>
              <dd data-testid="wallet-account">
                <HashValue value={state.account} href={addressUrl(config.data, batch.network, state.account)} />
              </dd>
            </div>
          )}
          {prepared && (
            <>
              <div>
                <dt className="text-xs text-muted-foreground">{t("treasury")}</dt>
                <dd>
                  <HashValue value={prepared.payload.treasury} href={addressUrl(config.data, batch.network, prepared.payload.treasury)} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t("contract")}</dt>
                <dd>
                  <HashValue value={prepared.payload.contract} href={addressUrl(config.data, batch.network, prepared.payload.contract)} />
                </dd>
              </div>
            </>
          )}
          {state.balance !== undefined && (
            <div>
              <dt className="text-xs text-muted-foreground">{t("balance")}</dt>
              <dd className="font-medium">
                <Money value={units(state.balance) ?? "0"} asset={batch.asset} />
              </dd>
            </div>
          )}
          {state.allowance !== undefined && (
            <div>
              <dt className="text-xs text-muted-foreground">{t("allowance")}</dt>
              <dd className="font-medium">
                <Money value={units(state.allowance) ?? "0"} asset={batch.asset} />
              </dd>
            </div>
          )}
          {state.approveTxHash && (
            <div>
              <dt className="text-xs text-muted-foreground">{t("approveTx")}</dt>
              <dd>
                <HashValue value={state.approveTxHash} href={txUrl(config.data, batch.network, state.approveTxHash)} kind="txHash" />
              </dd>
            </div>
          )}
          {state.txHash && (
            <div>
              <dt className="text-xs text-muted-foreground">{t("txHash")}</dt>
              <dd data-testid="wallet-tx">
                <HashValue value={state.txHash} href={batch.explorerUrl ?? txUrl(config.data, batch.network, state.txHash)} kind="txHash" />
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
