/**
 * Captures every page at desktop (1440) and mobile (390), in English and Arabic,
 * into screens/. Run: npm run screenshots (after npm run build).
 * Seeded mock ids are deterministic: PO-1003 = MEXC completed with issues,
 * PO-1010 = Trust Wallet approved, PO-1011 = MEXC draft.
 */
import { expect, test, type Page } from "@playwright/test";
import { fixture, login, type Role } from "./helpers";
import { installMockWallet } from "./mock-wallet";

const VIEWPORTS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;
const LOCALES = ["en", "ar"] as const;

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await expect(page.locator('[aria-busy="true"]:visible')).toHaveCount(0, { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400); // let fade-in animations finish
}

for (const [vp, size] of Object.entries(VIEWPORTS)) {
  for (const locale of LOCALES) {
    test.describe(`${vp} ${locale}`, () => {
      test.use({ viewport: size });
      const shot = (page: Page, name: string) => page.screenshot({ path: `screens/${name}-${vp}-${locale}.png`, fullPage: true });
      const as = async (page: Page, role: Role) => login(page, role, locale);

      test("login", async ({ page }) => {
        await page.goto("/login");
        await page.evaluate((l) => localStorage.setItem("apx.locale", l), locale);
        await page.reload();
        await expect(page.getByTestId("login-maker")).toBeVisible();
        await settle(page);
        await shot(page, "01-login");
      });

      test("dashboard", async ({ page }) => {
        await as(page, "maker");
        await expect(page.getByTestId("kpi-total-paid")).toBeVisible();
        await settle(page);
        await shot(page, "02-dashboard");
      });

      test("batches", async ({ page }) => {
        await as(page, "checker");
        await page.goto("/batches");
        await settle(page);
        await shot(page, "03-batches");
      });

      test("new payout", async ({ page }) => {
        await as(page, "maker");
        await page.goto("/payouts/new");
        await settle(page);
        await shot(page, "04-new-payout");
        await page.getByTestId("channel-mexc").click();
        await page.getByTestId("file-input").setInputFiles(fixture("invalid.xlsx"));
        await expect(page.getByTestId("validation-errors")).toBeVisible();
        await settle(page);
        await shot(page, "05-new-payout-errors");
        await page.getByTestId("file-input").setInputFiles(fixture("valid-mexc.xlsx"));
        await expect(page.getByTestId("validation-valid")).toBeVisible();
        await settle(page);
        await shot(page, "06-new-payout-valid");
      });

      test("batch details: checker on a draft", async ({ page }) => {
        await as(page, "checker");
        await page.goto("/batches/PO-1011");
        await expect(page.getByTestId("approve-batch")).toBeVisible();
        await settle(page);
        await shot(page, "07-batch-draft-checker");
        await page.getByTestId("approve-batch").click();
        await expect(page.getByRole("alertdialog")).toBeVisible();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `screens/08-approve-dialog-${vp}-${locale}.png` });
      });

      test("batch details: completed with issues", async ({ page }) => {
        await as(page, "executor");
        await page.goto("/batches/PO-1003");
        await expect(page.getByTestId("batch-details")).toHaveAttribute("data-status", "completed_with_issues");
        await settle(page);
        await shot(page, "09-batch-completed-issues");
      });

      test("batch details: MEXC processing", async ({ page }) => {
        await as(page, "executor");
        await page.goto("/batches/PO-1009");
        await page.getByTestId("pay-all").click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: `screens/10-pay-dialog-${vp}-${locale}.png` });
        await page.getByTestId("confirm-action").click();
        await expect(page.getByTestId("batch-details")).toHaveAttribute("data-status", "processing");
        await page.waitForTimeout(4500);
        await shot(page, "11-batch-processing");
      });

      test("trust wallet flow", async ({ page }) => {
        await installMockWallet(page);
        await as(page, "executor");
        await page.goto("/batches/PO-1010");
        await page.getByTestId("pay-trust").click();
        await page.getByTestId("confirm-action").click();
        await expect(page.getByTestId("trust-wallet-flow")).toBeVisible();
        await settle(page);
        await shot(page, "12-trust-wallet-start");
        await page.getByTestId("wallet-connect-injected").click();
        await expect(page.getByTestId("wallet-done")).toBeVisible({ timeout: 30_000 });
        await settle(page);
        await shot(page, "13-trust-wallet-done");
      });

      test("audit log", async ({ page }) => {
        await as(page, "checker");
        await page.goto("/audit");
        await settle(page);
        await shot(page, "14-audit");
      });

      if (vp === "mobile") {
        test("mobile drawer", async ({ page }) => {
          await as(page, "maker");
          await page.getByTestId("open-menu").click();
          await expect(page.getByTestId("mobile-drawer")).toBeVisible();
          await page.waitForTimeout(400);
          await page.screenshot({ path: `screens/15-drawer-${vp}-${locale}.png` });
        });
      }
    });
  }
}
