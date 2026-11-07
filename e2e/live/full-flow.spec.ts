/**
 * LIVE end-to-end: real NestJS API + BullMQ worker (dry-run) + Postgres, driven through the UI.
 * Tests run in order and share backend state (serial).
 */
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { installMockWallet } from "../mock-wallet";
import { invalidRows, mexcRows, runTag, sheet, trustRows } from "./sheets";

const API = process.env.LIVE_API_URL ?? "http://localhost:4000/api";
test.describe.configure({ mode: "serial" });

type Role = "maker" | "checker" | "executor";
let tokens: Record<Role, string>;
const tag = runTag();
const ids: Record<string, string> = {};

async function apiGet(request: APIRequestContext, path: string, role: Role = "maker") {
  const r = await request.get(`${API}${path}`, { headers: { Authorization: `Bearer ${tokens[role]}` } });
  expect(r.ok(), `${path} → ${r.status()}`).toBeTruthy();
  return r.json();
}

/** Visible text without the invisible Unicode bidi isolates (U+2066–U+2069) the UI wraps around data. */
const plain = (page: Page, testId: string) => async () => ((await page.getByTestId(testId).textContent()) ?? "").replace(/[⁦-⁩]/g, "");

async function login(page: Page, role: Role, locale: "en" | "ar" = "en") {
  await page.goto("/login");
  await page.evaluate((l) => localStorage.setItem("apx.locale", l), locale);
  await page.reload();
  await page.getByTestId(`login-${role}`).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("role-switcher")).toBeVisible();
}

async function switchRole(page: Page, role: Role) {
  await page.getByTestId("role-switcher").click();
  await page.getByTestId(`switch-role-${role}`).first().click();
  await expect(page.getByTestId("role-switcher")).toContainText(new RegExp(role, "i"));
}

async function uploadFile(page: Page, channel: "mexc" | "trust_wallet", name: string, buffer: Buffer) {
  await page.getByTestId("nav-newPayout").click();
  await page.getByTestId(`channel-${channel}`).click();
  await page.getByTestId("file-input").setInputFiles({ name, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer });
}

async function createBatch(page: Page, channel: "mexc" | "trust_wallet", buffer: Buffer): Promise<string> {
  await uploadFile(page, channel, `${channel}-${tag}.xlsx`, buffer);
  await expect(page.getByTestId("validation-valid")).toBeVisible();
  await page.getByTestId("submit-batch").click();
  await expect(page).toHaveURL(/\/batches\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("batch-details")).toHaveAttribute("data-status", "draft");
  return page.url().split("/").pop()!;
}

async function approve(page: Page) {
  await switchRole(page, "checker");
  await page.getByTestId("approve-batch").click();
  await page.getByTestId("confirm-action").click();
  await expect(page.getByTestId("batch-details")).toHaveAttribute("data-status", "approved");
}

test.beforeAll(async ({ request }) => {
  const users = (await (await request.get(`${API}/demo/users`)).json()) as { name: string; role: Role; token: string }[];
  tokens = { maker: users.find((u) => u.role === "maker")!.token, checker: users.find((u) => u.role === "checker")!.token, executor: users.find((u) => u.role === "executor")!.token };
});

test("a. sign-in lists the seeded demo users from the backend", async ({ page, request }) => {
  const users = (await (await request.get(`${API}/demo/users`)).json()) as { name: string }[];
  expect(users.map((u) => u.name)).toEqual(["Sara Haddad", "Omar Khalil", "Lina Mansour", "Youssef Amin"]);
  await page.goto("/login");
  for (const u of users) await expect(page.getByRole("button", { name: new RegExp(u.name) })).toBeVisible();
  await expect(page.getByTestId("testnet-badge")).toContainText("DRY-RUN");
  await expect(page.getByTestId("testnet-badge")).not.toContainText("Mock API"); // live mode
});

test("b. maker: invalid file → translated row errors; valid MEXC TRC20 file → batch created", async ({ page }) => {
  await login(page, "maker");
  await uploadFile(page, "mexc", `invalid-${tag}.xlsx`, await sheet(invalidRows(tag)));
  const errors = page.getByTestId("validation-errors");
  await expect(errors).toBeVisible();
  await expect.poll(plain(page, "error-row-2")).toContain('"not-an-address" is not a valid TRC20 address.');
  await expect(page.getByTestId("error-row-3")).toContainText("Amount is required.");
  await expect(page.getByTestId("error-row-4")).toContainText("Duplicate reference");
  await expect.poll(plain(page, "error-row-5")).toContain('Unsupported asset "BTC"');
  await expect.poll(plain(page, "error-row-6")).toContain("below the MEXC Exchange minimum of 1");
  await expect(page.getByTestId("submit-batch")).toBeDisabled();

  // Same file in Arabic: messages come from the issue codes, not the server's English text.
  await page.evaluate(() => localStorage.setItem("apx.locale", "ar"));
  await page.getByTestId("locale-toggle").click();
  await expect.poll(plain(page, "error-row-2")).toContain("ليس عنوان TRC20 صالحًا");
  await expect(page.getByTestId("error-row-4")).toContainText("مكرر");
  await page.getByTestId("locale-toggle").click(); // back to English

  ids.mexc = await createBatch(page, "mexc", await sheet(mexcRows(tag, ["125.50", "980", "42.75"])));
  await expect(page.getByTestId("batch-total")).toContainText("1,148.25");
});

test("c. maker can't approve (no action, API 403); checker approves", async ({ page, request }) => {
  await login(page, "maker");
  await page.goto(`/batches/${ids.mexc}`);
  await expect(page.getByTestId("batch-details")).toHaveAttribute("data-status", "draft");
  await expect(page.getByTestId("approve-batch")).toHaveCount(0);
  await expect(page.getByTestId("next-step")).toBeVisible();
  const r = await request.post(`${API}/batches/${ids.mexc}/approve`, { headers: { Authorization: `Bearer ${tokens.maker}` } });
  expect(r.status()).toBe(403);
  expect((await r.json()).code).toBe("FORBIDDEN_ROLE");
  await approve(page);
});

test("d. executor pays all → completed by the worker; a second execute is rejected (409) with a clear message", async ({ page, context }) => {
  await login(page, "executor");
  await page.goto(`/batches/${ids.mexc}`);
  await expect(page.getByTestId("pay-all")).toBeVisible();

  // A second tab opened BEFORE paying still shows the stale "approved" state.
  const stale = await context.newPage();
  await stale.goto(`/batches/${ids.mexc}`);
  await expect(stale.getByTestId("pay-all")).toBeVisible();

  await page.getByTestId("pay-all").click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("1,148.25");
  await expect(dialog).toContainText("TRC20");
  await dialog.getByTestId("confirm-action").click();
  const details = page.getByTestId("batch-details");
  await expect(details).toHaveAttribute("data-status", /processing|completed/);
  await expect(details).toHaveAttribute("data-status", "completed", { timeout: 60_000 });
  await expect(page.locator('[data-testid="item-row"][data-item-status="succeeded"]')).toHaveCount(3);

  await stale.getByTestId("pay-all").click();
  await stale.getByTestId("confirm-action").click();
  await expect(stale.getByText("This batch was already processed")).toBeVisible();
  await expect(stale.getByTestId("batch-details")).toHaveAttribute("data-status", "completed"); // refreshed after the 409
  await stale.close();
});

test("e. -FAIL and -RECON references → completed_with_issues with the right item statuses", async ({ page }) => {
  await login(page, "maker");
  ids.issues = await createBatch(page, "mexc", await sheet(mexcRows(`${tag}X`, ["10", "20", "30"], ["", "-FAIL", "-RECON"])));
  await approve(page);
  await switchRole(page, "executor");
  await page.getByTestId("pay-all").click();
  await page.getByTestId("confirm-action").click();
  await expect(page.getByTestId("batch-details")).toHaveAttribute("data-status", "completed_with_issues", { timeout: 60_000 });
  await expect(page.locator('[data-item-status="succeeded"]')).toHaveCount(1);
  await expect(page.locator('[data-item-status="failed"]')).toHaveCount(1);
  await expect(page.locator('[data-item-status="requires_reconciliation"]')).toHaveCount(1);
  await expect(page.getByTestId("items-table")).toContainText("whitelisted");
  await expect(page.getByTestId("items-table")).toContainText("outcome unknown");
});

test("f. Trust Wallet (BEP20): base-unit payload, one signed tx, simulated verification → completed + Simulated badge", async ({ page }) => {
  await installMockWallet(page); // injected Trust Wallet provider; account = backend treasury
  await login(page, "maker");
  ids.trust = await createBatch(page, "trust_wallet", await sheet(trustRows(tag, ["250.00", "0.5", "1200.123456"])));
  await approve(page);
  await switchRole(page, "executor");

  const payloadResponse = page.waitForResponse((r) => r.url().endsWith(`/batches/${ids.trust}/onchain-payload`));
  await page.getByTestId("pay-trust").click();
  await expect(page.getByRole("alertdialog")).toContainText("1,450.623456");
  await page.getByTestId("confirm-action").click();
  await page.getByTestId("wallet-connect-injected").click();

  const payload = await (await payloadResponse).json();
  expect(payload).toMatchObject({ chainId: 97, tokenDecimals: 6, total: "1450623456", amounts: ["250000000", "500000", "1200123456"] });
  expect(payload.batchRef).toBe(`0x${ids.trust!.replace(/-/g, "")}${"0".repeat(32)}`);

  await expect(page.getByTestId("wallet-tx")).toBeVisible();
  await expect(page.getByTestId("wallet-done")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("batch-details")).toHaveAttribute("data-status", "completed");
  await expect(page.getByTestId("simulated-badge")).toBeVisible();
  await expect(page.getByTestId("simulated-badge")).toHaveText("Simulated");
});

test("g. dashboard KPIs and audit log reflect the runs", async ({ page, request }) => {
  const stats = await apiGet(request, "/dashboard/stats");
  await login(page, "checker");
  const fmt = (v: string) => {
    const [i, f = ""] = v.split(".");
    return `${i!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${f.slice(0, 2).padEnd(2, "0")}`;
  };
  await expect(page.getByTestId("kpi-total-paid")).toContainText(fmt(stats.totalPaid));
  await expect(page.getByTestId("kpi-pending")).toContainText(String(stats.pendingApprovalCount));
  await expect(page.getByTestId("kpi-reconciliation")).toContainText(String(stats.needsReconciliationCount));

  // Every batch from this run is listed with its final status.
  for (const [key, status] of [["mexc", "completed"], ["issues", "completed_with_issues"], ["trust", "completed"]] as const) {
    const b = await apiGet(request, `/batches/${ids[key]}`);
    expect(b.status).toBe(status);
  }

  await page.getByTestId("nav-audit").click();
  await page.getByTestId("audit-batch").fill(ids.issues!);
  const table = page.getByTestId("audit-table");
  await expect(table).toContainText("Withdrawal failed");
  await expect(table).toContainText("Withdrawal needs reconciliation");
  await expect(table).toContainText("Completed with issues");
  await expect(table).toContainText("MEXC payout started");

  await page.getByTestId("audit-batch").fill(ids.trust!);
  await expect(table).toContainText("Transaction submitted");
  await expect(table).toContainText("Transaction verified");
  await expect(table).toContainText("Simulated");
});
