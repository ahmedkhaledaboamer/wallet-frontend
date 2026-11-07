import { expect, test, type Page } from "@playwright/test";
import { approveAsChecker, createBatch, login, switchRole } from "./helpers";
import { decodeFunctionData } from "viem";
import { batchPayoutAbi } from "../src/lib/wallet/abi";
import { installMockWallet, walletCalls } from "./mock-wallet";

async function openTrustFlow(page: Page) {
  await page.getByTestId("pay-trust").click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("2,205.74");
  await expect(dialog).toContainText("BEP20");
  await dialog.getByTestId("confirm-action").click();
  await expect(page.getByTestId("trust-wallet-flow")).toBeVisible();
}

test("Trust Wallet: connect → network → approve exact → simulate → sign → verify → done", async ({ page }) => {
  await installMockWallet(page, { rejectFirstPayout: true });
  await login(page, "maker");
  await createBatch(page, "trust_wallet", "valid-trust.xlsx");
  await approveAsChecker(page);
  await switchRole(page, "executor");
  await openTrustFlow(page);

  await page.getByTestId("wallet-connect-injected").click();

  // First payout signature is rejected in the wallet → clear human error, nothing sent.
  const error = page.getByTestId("wallet-error");
  await expect(error).toHaveAttribute("data-code", "userRejected");
  await expect(error).toContainText("You rejected the request");
  await expect(page.getByTestId("wallet-step-confirm")).toHaveAttribute("data-state", "error");
  await expect(page.getByTestId("wallet-step-approve")).toHaveAttribute("data-state", "complete");

  // Retry signs; the flow reports the tx and waits for the backend to finalize.
  await page.getByTestId("wallet-retry").click();
  await expect(page.getByTestId("wallet-tx")).toBeVisible();
  await expect(page.getByTestId("wallet-done")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("batch-details")).toHaveAttribute("data-status", "completed");
  await expect(page.getByTestId("wallet-account")).toContainText("0x8ba1");

  // The wallet saw: chain switch to BSC testnet, ONE exact approval (never unlimited), ONE payout tx.
  const calls = await walletCalls(page);
  const switched = calls.find((c) => c.method === "wallet_switchEthereumChain");
  expect((switched?.params as { chainId: string }[])[0].chainId).toBe("0x61");
  const sends = calls.filter((c) => c.method === "eth_sendTransaction").map((c) => (c.params as { data: string }[])[0].data);
  const approvals = sends.filter((d) => d.startsWith("0x095ea7b3"));
  expect(approvals).toHaveLength(1);
  const approvedAmount = BigInt("0x" + approvals[0].slice(10 + 64, 10 + 128));
  expect(approvedAmount).toBe(BigInt("2205740000000000000000")); // 2,205.74 × 10^18 exactly
  // Two payout requests reached the wallet: the one the user rejected, and the one they signed.
  const payouts = sends.filter((d) => !d.startsWith("0x095ea7b3"));
  expect(payouts).toHaveLength(2);

  // payout(bytes32 batchRef, IERC20 token, address[] recipients, uint256[] amounts) — server base units passed through unchanged.
  const { functionName, args } = decodeFunctionData({ abi: batchPayoutAbi, data: payouts[1] as `0x${string}` });
  expect(functionName).toBe("payout");
  expect(args[0]).toMatch(/^0x[0-9a-f]{64}$/);
  expect(args[1].toLowerCase()).toBe("0x337610d27c682e347c9cd60bd4b3b107c9d34ddd");
  expect(args[2]).toHaveLength(5);
  expect(args[3].reduce((x, y) => x + y, BigInt(0))).toBe(BigInt("2205740000000000000000"));
});

test("Trust Wallet: wrong account is blocked before anything is signed", async ({ page }) => {
  await installMockWallet(page, { account: "0x1111111111111111111111111111111111111111" });
  await login(page, "maker");
  await createBatch(page, "trust_wallet", "valid-trust.xlsx");
  await approveAsChecker(page);
  await switchRole(page, "executor");
  await openTrustFlow(page);
  await page.getByTestId("wallet-connect-injected").click();
  const error = page.getByTestId("wallet-error");
  await expect(error).toHaveAttribute("data-code", "wrongAccount");
  await expect(error).toContainText("isn't the treasury wallet");
  const calls = await walletCalls(page);
  expect(calls.some((c) => c.method === "eth_sendTransaction")).toBe(false);
});

test("Trust Wallet: insufficient token balance is explained", async ({ page }) => {
  await installMockWallet(page, { balance: "1000000000000000000" }); // 1 token
  await login(page, "maker");
  await createBatch(page, "trust_wallet", "valid-trust.xlsx");
  await approveAsChecker(page);
  await switchRole(page, "executor");
  await openTrustFlow(page);
  await page.getByTestId("wallet-connect-injected").click();
  const error = page.getByTestId("wallet-error");
  await expect(error).toHaveAttribute("data-code", "insufficientBalance");
  await expect(error).toContainText("2,205.74 USDT");
});

test("Trust Wallet: QR fallback is hidden gracefully without a Reown project ID", async ({ page }) => {
  await installMockWallet(page);
  await login(page, "executor");
  await page.goto("/batches?channel=trust_wallet&status=approved");
  await page.locator('[data-testid^="batch-row-"] a').first().click();
  await page.getByTestId("pay-trust").click();
  await page.getByRole("alertdialog").getByTestId("confirm-action").click();
  await expect(page.getByTestId("wallet-connect-qr")).toHaveCount(0);
  await expect(page.getByTestId("qr-unavailable")).toBeVisible();
});
