import { getAddress } from "viem";
import type { AppConfig, Network, NetworkConfig } from "../schemas";

export const MOCK_NETWORKS: NetworkConfig[] = [
  { network: "TRC20", name: "TRON Nile Testnet", explorerUrl: "https://nile.tronscan.org/#" },
  { network: "BEP20", chainId: 97, name: "BNB Smart Chain Testnet", explorerUrl: "https://testnet.bscscan.com" },
  { network: "ERC20", chainId: 11155111, name: "Ethereum Sepolia", explorerUrl: "https://sepolia.etherscan.io" },
];

export const MOCK_CONFIG: AppConfig = {
  environment: "testnet",
  dryRun: true,
  networks: MOCK_NETWORKS,
  maxRows: 500,
  maxBatchTotal: "250000",
};

/** Treasury wallet that must sign Trust Wallet batches (the e2e mock provider uses this account). */
export const MOCK_TREASURY = getAddress("0x8ba1f109551bd432803012645ac136ddd64dba72");
/** Batch payout contract (same address on both testnets in the mock). */
export const MOCK_PAYOUT_CONTRACT = getAddress("0x5fbdb2315678afecb367f032d93f642f64180aa3");

export const MOCK_TOKENS: Record<Exclude<Network, "TRC20">, { address: `0x${string}`; decimals: number }> = {
  BEP20: { address: getAddress("0x337610d27c682e347c9cd60bd4b3b107c9d34ddd"), decimals: 18 },
  ERC20: { address: getAddress("0x7169d38820dfd117c3fa1f22a697dba58d90ba06"), decimals: 6 },
};

export const SUPPORTED_ASSETS = ["USDT"] as const;

/** Reference suffixes that make the mock provider fail an item (documented in README). */
export const MOCK_FAIL_MARKER = "-FAIL";
export const MOCK_RECON_MARKER = "-RECON";

export const TEMPLATE_COLUMNS = ["reference", "address", "amount", "asset", "network", "memo"] as const;
export const REQUIRED_COLUMNS = ["reference", "address", "amount", "asset", "network"] as const;
