import type { EIP1193Provider } from "viem";
import { env, isWalletConnectEnabled } from "@/lib/env";

type InjectedProvider = EIP1193Provider & { isTrust?: boolean; isTrustWallet?: boolean; providers?: InjectedProvider[] };

declare global {
  interface Window {
    trustwallet?: InjectedProvider;
    ethereum?: InjectedProvider;
  }
}

export type ProviderKind = "trust" | "injected" | "walletconnect";

export interface DetectedProvider {
  kind: ProviderKind;
  provider: EIP1193Provider;
}

const isTrust = (p?: InjectedProvider) => Boolean(p && (p.isTrust || p.isTrustWallet));

/** Trust Wallet first (extension / in-app browser), then any other injected wallet. */
export function detectInjected(): DetectedProvider | null {
  if (typeof window === "undefined") return null;
  if (window.trustwallet) return { kind: "trust", provider: window.trustwallet };
  const eth = window.ethereum;
  if (isTrust(eth)) return { kind: "trust", provider: eth! };
  const multi = eth?.providers?.find(isTrust);
  if (multi) return { kind: "trust", provider: multi };
  if (eth) return { kind: "injected", provider: eth };
  return null;
}

let wcProvider: EIP1193Provider | undefined;

/**
 * WalletConnect (Reown) QR fallback. Loaded on demand; only available when
 * NEXT_PUBLIC_REOWN_PROJECT_ID is configured.
 */
export async function connectWalletConnect(chainId: number): Promise<DetectedProvider> {
  if (!isWalletConnectEnabled) throw new Error("WalletConnect is not configured");
  if (!wcProvider) {
    const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
    const p = await EthereumProvider.init({
      projectId: env.reownProjectId,
      optionalChains: [chainId],
      showQrModal: true,
      metadata: {
        name: "Apexaora Batch Payouts",
        description: "Batch payout signing (testnet)",
        url: window.location.origin,
        icons: [`${window.location.origin}/icon.png`],
      },
    });
    await p.connect();
    wcProvider = p as unknown as EIP1193Provider;
  }
  return { kind: "walletconnect", provider: wcProvider };
}

export async function disconnectWalletConnect() {
  const p = wcProvider as unknown as { disconnect?: () => Promise<void> } | undefined;
  wcProvider = undefined;
  await p?.disconnect?.().catch(() => undefined);
}
