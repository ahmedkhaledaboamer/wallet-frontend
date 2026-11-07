import type { Page } from "@playwright/test";
import { toFunctionSelector } from "viem";

export interface MockWalletOptions {
  account?: string;
  /** Chain the wallet starts on (hex). Defaults to Ethereum mainnet so the flow must switch. */
  startChainId?: string;
  /** Token balance in base units (decimal string). */
  balance?: string;
  /** Reject the first eth_sendTransaction for the payout (user clicks "Reject" in the wallet). */
  rejectFirstPayout?: boolean;
}

/**
 * Injects a minimal EIP-1193 provider that impersonates Trust Wallet
 * (`window.ethereum.isTrust`). It answers just enough JSON-RPC for viem:
 * accounts, chain switching, ERC-20 reads, simulation, sending and receipts.
 * All calls are recorded on `window.__walletCalls` for assertions.
 */
export async function installMockWallet(page: Page, opts: MockWalletOptions = {}) {
  const config = {
    account: (opts.account ?? "0x8ba1f109551bd432803012645ac136ddd64dba72").toLowerCase(),
    chainId: opts.startChainId ?? "0x1",
    balance: opts.balance ?? "1000000000000000000000000", // 1,000,000 tokens @ 18 decimals
    rejectFirstPayout: !!opts.rejectFirstPayout,
    selectors: {
      balanceOf: toFunctionSelector("balanceOf(address)"),
      allowance: toFunctionSelector("allowance(address,address)"),
      approve: toFunctionSelector("approve(address,uint256)"),
      payout: toFunctionSelector("payout(bytes32,address,address[],uint256[])"),
    },
  };

  await page.addInitScript((cfg) => {
    type Tx = { from?: string; to?: string; data?: string };
    const state = { chainId: cfg.chainId, allowance: BigInt(0), rejected: false, txs: {} as Record<string, Tx> };
    const calls: { method: string; params?: unknown }[] = [];
    (window as unknown as { __walletCalls: typeof calls }).__walletCalls = calls;
    const word = (n: bigint) => "0x" + n.toString(16).padStart(64, "0");
    const hash = () => "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
    const err = (code: number, message: string) => Object.assign(new Error(message), { code });

    const provider = {
      isTrust: true,
      isTrustWallet: true,
      on() {},
      removeListener() {},
      async request({ method, params }: { method: string; params?: unknown[] }) {
        calls.push({ method, params });
        switch (method) {
          case "eth_requestAccounts":
          case "eth_accounts":
            return [cfg.account];
          case "eth_chainId":
            return state.chainId;
          case "net_version":
            return String(parseInt(state.chainId, 16));
          case "wallet_switchEthereumChain":
            state.chainId = (params![0] as { chainId: string }).chainId;
            return null;
          case "wallet_addEthereumChain":
            return null;
          case "eth_blockNumber":
            return "0x100";
          case "eth_getBalance":
            return "0xde0b6b3a7640000"; // 1 native coin for gas
          case "eth_gasPrice":
            return "0x3b9aca00";
          case "eth_maxPriorityFeePerGas":
            return "0x3b9aca00";
          case "eth_estimateGas":
            return "0x30d40";
          case "eth_getTransactionCount":
            return "0x1";
          case "eth_getBlockByNumber":
            return { number: "0x100", hash: hash(), timestamp: "0x6553f100", baseFeePerGas: "0x3b9aca00", gasLimit: "0x1c9c380", gasUsed: "0x0", transactions: [] };
          case "eth_call": {
            const data = ((params![0] as Tx).data ?? "").toLowerCase();
            if (data.startsWith(cfg.selectors.balanceOf)) return word(BigInt(cfg.balance));
            if (data.startsWith(cfg.selectors.allowance)) return word(state.allowance);
            if (data.startsWith(cfg.selectors.payout)) {
              if (state.allowance === BigInt(0)) throw err(3, "execution reverted: ERC20: insufficient allowance");
              return "0x";
            }
            return "0x";
          }
          case "eth_sendTransaction": {
            const tx = params![0] as Tx;
            const data = (tx.data ?? "").toLowerCase();
            if (data.startsWith(cfg.selectors.payout) && cfg.rejectFirstPayout && !state.rejected) {
              state.rejected = true;
              throw err(4001, "User rejected the request.");
            }
            if (data.startsWith(cfg.selectors.approve)) state.allowance = BigInt("0x" + data.slice(10 + 64, 10 + 128));
            const h = hash();
            state.txs[h] = tx;
            return h;
          }
          case "eth_getTransactionByHash": {
            const tx = state.txs[(params![0] as string)];
            return tx ? { hash: params![0], ...tx, blockNumber: "0x100", blockHash: hash(), nonce: "0x1", gas: "0x30d40", value: "0x0", input: tx.data, transactionIndex: "0x0", type: "0x2" } : null;
          }
          case "eth_getTransactionReceipt": {
            const h = params![0] as string;
            const tx = state.txs[h];
            if (!tx) return null;
            return {
              transactionHash: h,
              transactionIndex: "0x0",
              blockHash: hash(),
              blockNumber: "0x100",
              from: tx.from ?? cfg.account,
              to: tx.to ?? null,
              cumulativeGasUsed: "0x5208",
              gasUsed: "0x5208",
              effectiveGasPrice: "0x3b9aca00",
              contractAddress: null,
              logs: [],
              logsBloom: "0x" + "0".repeat(512),
              status: "0x1",
              type: "0x2",
            };
          }
          default:
            throw err(4200, `Mock wallet: unsupported method ${method}`);
        }
      },
    };
    (window as unknown as { ethereum: typeof provider }).ethereum = provider;
  }, config);
}

export async function walletCalls(page: Page): Promise<{ method: string; params?: unknown }[]> {
  return page.evaluate(() => (window as unknown as { __walletCalls: { method: string; params?: unknown }[] }).__walletCalls);
}
