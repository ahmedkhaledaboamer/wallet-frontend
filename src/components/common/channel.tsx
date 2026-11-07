"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Channel, Network } from "@/lib/api/schemas";

/*
 * Neutral, generic channel pictograms (deliberately NOT the official logos).
 * Exchange: a building with two counter-flowing arrows. Wallet: a shielded wallet.
 */
export function ExchangeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M4.5 20h15" />
      <path d="M8 16.5h8.5l-2-2" />
      <path d="M16 12.5H7.5l2 2" />
    </svg>
  );
}

export function WalletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M19 8V6.5A2.5 2.5 0 0 0 16.5 4H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h6" />
      <path d="M3 8h15a3 3 0 0 1 3 3v1" />
      <path d="M18 14.5l3.5 1.25v2.5c0 1.9-1.5 3.1-3.5 3.75-2-.65-3.5-1.85-3.5-3.75v-2.5Z" />
    </svg>
  );
}

export function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  return channel === "mexc" ? <ExchangeIcon className={className} /> : <WalletIcon className={className} />;
}

export function ChannelLabel({ channel, short = false, className }: { channel: Channel; short?: boolean; className?: string }) {
  const t = useTranslations("channel");
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap", className)}>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
        <ChannelIcon channel={channel} className="size-3.5" />
      </span>
      {short ? t(`${channel}Short`) : t(channel)}
    </span>
  );
}

export function NetworkChip({ network, asset, className }: { network: Network; asset?: string; className?: string }) {
  return (
    <span
      dir="ltr"
      className={cn(
        "num inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {asset && <span className="text-foreground">{asset}</span>}
      {asset && <span aria-hidden>·</span>}
      {network}
    </span>
  );
}
