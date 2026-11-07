"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { ExchangeIcon, WalletIcon } from "@/components/common/channel";
import type { Channel } from "@/lib/api/schemas";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Channel; icon: typeof ExchangeIcon; title: "mexcTitle" | "trustTitle"; body: "mexcBody" | "trustBody"; nets: "mexcNetworks" | "trustNetworks" }[] = [
  { value: "mexc", icon: ExchangeIcon, title: "mexcTitle", body: "mexcBody", nets: "mexcNetworks" },
  { value: "trust_wallet", icon: WalletIcon, title: "trustTitle", body: "trustBody", nets: "trustNetworks" },
];

/** Two rich radio cards. Native radios give arrow-key navigation and screen-reader semantics for free. */
export function ChannelPicker({ value, onChange }: { value?: Channel; onChange: (c: Channel) => void }) {
  const t = useTranslations("newPayout");
  return (
    <fieldset>
      <legend className="sr-only">{t("stepChannel")}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map(({ value: v, icon: Icon, title, body, nets }) => {
          const selected = value === v;
          return (
            <label
              key={v}
              data-testid={`channel-${v}`}
              className={cn(
                "group relative flex cursor-pointer flex-col gap-3 rounded-2xl border bg-card p-5 shadow-card transition-all",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                selected
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised",
              )}
            >
              <input
                type="radio"
                name="channel"
                value={v}
                checked={selected}
                onChange={() => onChange(v)}
                className="sr-only"
              />
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "flex size-12 items-center justify-center rounded-xl transition-colors",
                    selected ? "bg-primary text-primary-foreground" : "bg-secondary text-primary",
                  )}
                >
                  <Icon className="size-6" />
                </span>
                <CheckCircle2
                  aria-hidden
                  className={cn("size-5 transition-all", selected ? "scale-100 text-primary opacity-100" : "scale-75 opacity-0")}
                />
              </div>
              <div>
                <p className="font-heading text-base font-semibold">{t(title)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{body && t(body)}</p>
              </div>
              <span
                dir="ltr"
                className={cn(
                  "mt-auto w-fit rounded-md px-2 py-0.5 text-xs font-semibold",
                  v === "trust_wallet" ? "bg-status-reconciliation-bg text-status-reconciliation-fg" : "bg-muted text-muted-foreground",
                )}
              >
                {t(nets)}
              </span>
              {selected && <span className="sr-only">{t("selected")}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
