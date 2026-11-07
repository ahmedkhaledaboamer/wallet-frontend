"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  createWalletClient,
  custom,
  defineChain,
  getAddress,
  publicActions,
  type Address,
  type Chain,
  type EIP1193Provider,
  type Hash,
} from "viem";
import { bscTestnet, sepolia } from "viem/chains";
import { formatAmount, fromUnits } from "@/lib/amount";
import { api } from "@/lib/api";
import { useConfig, useSubmitTransaction } from "@/lib/api/queries";
import { FINAL_BATCH_STATUSES, type Batch } from "@/lib/api/schemas";
import { batchPayoutAbi, erc20Abi } from "./abi";
import { FlowError, isUnknownChain, isUserRejection, toWalletError } from "./errors";
import { flowReducer, initialFlowState, resumeWithTx, type FlowState, type StepId, type WalletErrorCode } from "./machine";
import { clearPendingTx, loadPendingTx, preparePayload, savePendingTx, type PreparedPayload } from "./payload";
import { connectWalletConnect, detectInjected, type DetectedProvider, type ProviderKind } from "./provider";

const KNOWN_CHAINS: Record<number, Chain> = { [bscTestnet.id]: bscTestnet, [sepolia.id]: sepolia };

function chainFor(chainId: number, name: string, explorerUrl?: string): Chain {
  return (
    KNOWN_CHAINS[chainId] ??
    defineChain({
      id: chainId,
      name,
      nativeCurrency: { name: "Native", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [] } },
      blockExplorers: explorerUrl ? { default: { name: "Explorer", url: explorerUrl } } : undefined,
    })
  );
}

function makeClient(provider: EIP1193Provider, account: Address, chain: Chain) {
  return createWalletClient({ account, chain, transport: custom(provider) }).extend(publicActions);
}
type Client = ReturnType<typeof makeClient>;

interface Ctx {
  detected?: DetectedProvider;
  prepared?: PreparedPayload;
  chain?: Chain;
  client?: Client;
}

/** Error code to use when a step fails for an unclassified reason. */
const FALLBACK: Record<StepId, WalletErrorCode> = {
  connect: "unknown",
  network: "switchFailed",
  approve: "unknown",
  simulate: "simulationFailed",
  confirm: "unknown",
  verify: "backend",
  done: "unknown",
};

export interface TrustWalletFlow {
  state: FlowState;
  prepared?: PreparedPayload;
  /** Injected wallet detected at mount (Trust Wallet or another). */
  injected: ProviderKind | null;
  start: (via: "injected" | "walletconnect") => void;
  retry: () => void;
  reset: () => void;
  /** Human formatting of base units with the payload's token decimals. */
  formatUnits: (units?: string) => string | undefined;
}

export function useTrustWalletFlow(batch: Batch): TrustWalletFlow {
  const config = useConfig();
  const submitTx = useSubmitTransaction(batch.id);
  const [state, dispatch] = useReducer(flowReducer, batch.id, (id) => {
    const pending = typeof window !== "undefined" ? loadPendingTx(id) : null;
    return pending ? resumeWithTx(pending) : initialFlowState;
  });
  const ctx = useRef<Ctx>({});
  const [prepared, setPrepared] = useState<PreparedPayload>();
  const [injected] = useState<ProviderKind | null>(() => detectInjected()?.kind ?? null);
  const running = useRef(false);
  const via = useRef<"injected" | "walletconnect">("injected");
  const netConfig = config.data?.networks.find((n) => n.network === batch.network);

  const wallet = async <T,>(fn: () => Promise<T>): Promise<T> => {
    dispatch({ type: "WAITING_WALLET" });
    try {
      return await fn();
    } finally {
      dispatch({ type: "RUNNING" });
    }
  };

  const run = useCallback(
    async (from: StepId, current: FlowState) => {
      if (running.current) return;
      running.current = true;
      let step = from;
      const c = ctx.current;
      try {
        // ── 1. Connect + fetch & verify the payload ────────────────────────
        if (step === "connect") {
          const raw = await api().getOnchainPayload(batch.id);
          const p = preparePayload(raw, batch, netConfig?.chainId);
          c.prepared = p;
          setPrepared(p);
          c.chain = chainFor(p.payload.chainId, netConfig?.name ?? batch.network, netConfig?.explorerUrl);

          c.detected = via.current === "walletconnect" ? await connectWalletConnect(p.payload.chainId) : (detectInjected() ?? undefined);
          if (!c.detected) throw new FlowError({ code: "noProvider" });
          const accounts = (await wallet(() => c.detected!.provider.request({ method: "eth_requestAccounts" })));
          const account = accounts?.[0];
          if (!account) throw new FlowError({ code: "noProvider" });
          if (getAddress(account) !== getAddress(p.payload.treasury)) {
            throw new FlowError({ code: "wrongAccount", params: { account: getAddress(account), treasury: getAddress(p.payload.treasury) } });
          }
          c.client = makeClient(c.detected.provider, getAddress(account), c.chain);
          dispatch({ type: "CONNECTED", account: getAddress(account) });
          step = "network";
        }

        const { client, prepared: p, chain } = c;
        if (step !== "verify" && (!client || !p || !chain)) throw new FlowError({ code: "noProvider" });

        // ── 2. Network + balances ──────────────────────────────────────────
        if (step === "network") {
          const networkName = netConfig?.name ?? batch.network;
          if ((await client!.getChainId()) !== chain!.id) {
            try {
              await wallet(() => client!.switchChain({ id: chain!.id }));
            } catch (e) {
              if (isUserRejection(e)) throw e;
              if (isUnknownChain(e) && KNOWN_CHAINS[chain!.id]) {
                await wallet(() => client!.addChain({ chain: chain! }));
              } else {
                throw new FlowError({ code: "switchFailed", params: { network: networkName } });
              }
            }
            if ((await client!.getChainId()) !== chain!.id) throw new FlowError({ code: "wrongNetwork", params: { network: networkName } });
          }
          const owner = client!.account.address;
          const [balance, allowance, native] = await Promise.all([
            client!.readContract({ address: p!.payload.token, abi: erc20Abi, functionName: "balanceOf", args: [owner] }),
            client!.readContract({ address: p!.payload.token, abi: erc20Abi, functionName: "allowance", args: [owner, p!.payload.contract] }),
            client!.getBalance({ address: owner }),
          ]);
          if (balance < p!.totalUnits) {
            const d = p!.payload.tokenDecimals;
            throw new FlowError({
              code: "insufficientBalance",
              params: {
                balance: `${formatAmount(fromUnits(balance, d))} ${batch.asset}`,
                required: `${formatAmount(fromUnits(p!.totalUnits, d))} ${batch.asset}`,
              },
            });
          }
          if (native === BigInt(0)) throw new FlowError({ code: "insufficientGas" });
          dispatch({ type: "NETWORK_OK", balance: balance.toString(), allowance: allowance.toString() });
          step = "approve";
        }

        // ── 3. Approve EXACTLY the total, only if the allowance is short ───
        if (step === "approve") {
          const owner = client!.account.address;
          const allowance = await client!.readContract({
            address: p!.payload.token,
            abi: erc20Abi,
            functionName: "allowance",
            args: [owner, p!.payload.contract],
          });
          if (allowance >= p!.totalUnits) {
            dispatch({ type: "APPROVE_SKIPPED" });
          } else {
            const hash = await wallet(() =>
              client!.writeContract({
                address: p!.payload.token,
                abi: erc20Abi,
                functionName: "approve",
                args: [p!.payload.contract, p!.totalUnits], // exact amount — never maxUint256
              }),
            );
            dispatch({ type: "APPROVE_SENT", hash });
            const receipt = await client!.waitForTransactionReceipt({ hash, pollingInterval: 1_000 });
            if (receipt.status !== "success") throw new FlowError({ code: "txReverted" });
            const after = await client!.readContract({
              address: p!.payload.token,
              abi: erc20Abi,
              functionName: "allowance",
              args: [owner, p!.payload.contract],
            });
            if (after < p!.totalUnits) throw new FlowError({ code: "txReverted" });
            dispatch({ type: "APPROVED", allowance: after.toString() });
          }
          step = "simulate";
        }

        // ── 4. Simulate ────────────────────────────────────────────────────
        let request: Parameters<Client["writeContract"]>[0] | undefined;
        if (step === "simulate" || step === "confirm") {
          const sim = await client!.simulateContract({
            address: p!.payload.contract,
            abi: batchPayoutAbi,
            functionName: "payout",
            // payout(bytes32 batchRef, IERC20 token, address[] recipients, uint256[] amounts) — amounts in base units
            args: [p!.batchRef, p!.payload.token, p!.payload.recipients.map((r) => getAddress(r)), p!.amountUnits],
            account: client!.account,
          });
          request = sim.request as Parameters<Client["writeContract"]>[0];
          if (step === "simulate") dispatch({ type: "SIMULATED" });
          step = "confirm";
        }

        // ── 5. Sign the single payout transaction ──────────────────────────
        let txHash = current.txHash as Hash | undefined;
        if (step === "confirm") {
          txHash = await wallet(() => client!.writeContract(request!));
          savePendingTx(batch.id, txHash);
          dispatch({ type: "TX_SENT", hash: txHash });
          step = "verify";
        }

        // ── 6. Report to the backend (it verifies on-chain) ────────────────
        if (step === "verify" && txHash && !current.reported) {
          try {
            await submitTx.mutateAsync(txHash);
          } catch (e) {
            throw new FlowError({ code: "backend", params: { message: e instanceof Error ? e.message : String(e) } });
          }
          dispatch({ type: "REPORTED" });
        }
      } catch (e) {
        dispatch({ type: "FAIL", error: toWalletError(e, FALLBACK[step]) });
      } finally {
        running.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `wallet` only dispatches; batch identity changes on every poll
    [batch.id, batch.itemCount, batch.totalAmount, batch.network, batch.asset, netConfig, submitTx],
  );

  // ── 7. Done once the backend marks the batch final ─────────────────────────
  useEffect(() => {
    if (state.step === "verify" && state.reported && FINAL_BATCH_STATUSES.includes(batch.status)) {
      clearPendingTx(batch.id);
      dispatch({ type: "FINAL", status: batch.status });
    }
  }, [state.step, state.reported, batch.status, batch.id]);

  // If the backend already moved the batch past "approved" (e.g. reported in another tab), treat it as reported.
  useEffect(() => {
    if (state.step === "verify" && !state.reported && state.txHash && batch.status !== "approved" && batch.txHash) {
      dispatch({ type: "REPORTED" });
    }
  }, [state.step, state.reported, state.txHash, batch.status, batch.txHash]);

  const start = (how: "injected" | "walletconnect") => {
    via.current = how;
    dispatch({ type: "START" });
    void run(state.step, state);
  };
  const retry = () => {
    dispatch({ type: "RETRY" });
    void run(state.step, state);
  };
  const reset = () => {
    dispatch({ type: "RESET" });
    if (state.txHash) void run("verify", state);
  };

  const decimals = prepared?.payload.tokenDecimals;
  const formatUnits = (units?: string) =>
    units === undefined || decimals === undefined ? undefined : formatAmount(fromUnits(BigInt(units), decimals));

  return { state, prepared, injected, start, retry, reset, formatUnits };
}
