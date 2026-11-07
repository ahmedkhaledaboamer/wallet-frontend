import { expect, test } from "@playwright/test";
import { approveAsChecker, fixture, login, switchRole } from "./helpers";

test("upload → validation errors → valid upload → approve → pay via MEXC → completed", async ({ page }) => {
  await login(page, "maker");

  // 1. New payout: channel + a bad file → errors table keyed by Excel row
  await page.getByTestId("nav-newPayout").click();
  await page.getByTestId("channel-mexc").click();
  await page.getByTestId("file-input").setInputFiles(fixture("invalid.xlsx"));
  const errors = page.getByTestId("validation-errors");
  await expect(errors).toBeVisible();
  await expect(page.getByTestId("error-row-3")).toContainText("not a valid TRC20 address");
  await expect(page.getByTestId("error-row-4")).toContainText("Amount is required");
  await expect(page.getByTestId("error-row-5")).toContainText("Duplicate reference");
  await expect(page.getByTestId("error-row-6")).toContainText("Unsupported asset");
  await expect(page.getByTestId("error-row-7")).toContainText("Unsupported network");
  await expect(page.getByTestId("submit-batch")).toBeDisabled();

  // 2. Replace with a valid file → summary, then create
  await page.getByTestId("file-input").setInputFiles(fixture("valid-mexc.xlsx"));
  const summary = page.getByTestId("validation-valid");
  await expect(summary).toBeVisible();
  await expect(summary).toContainText("8");
  await expect(summary).toContainText("5,252.54");
  await expect(summary).toContainText("TRC20");
  await page.getByTestId("submit-batch").click();
  await expect(page).toHaveURL(/\/batches\/PO-\d+$/);
  const details = page.getByTestId("batch-details");
  await expect(details).toHaveAttribute("data-status", "draft");
  await expect(page.getByTestId("batch-total")).toContainText("5,252.54");

  // Maker can't approve
  await expect(page.getByTestId("approve-batch")).toHaveCount(0);

  // 3. Checker approves (with a confirm dialog)
  await approveAsChecker(page);

  // 4. Executor pays all — confirm dialog restates total / count / network
  await switchRole(page, "executor");
  await page.getByTestId("pay-all").click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("5,252.54");
  await expect(dialog).toContainText("8");
  await expect(dialog).toContainText("TRC20");
  await dialog.getByTestId("confirm-action").click();

  // 5. Processing (polled every 3s) → completed
  await expect(details).toHaveAttribute("data-status", "processing");
  await expect(details).toHaveAttribute("data-status", "completed", { timeout: 45_000 });
  await expect(page.getByTestId("batch-progress")).toHaveAttribute("aria-valuenow", "8");
  await expect(page.locator('[data-testid="item-row"][data-item-status="succeeded"]')).toHaveCount(8);
  await expect(page.getByTestId("audit-timeline")).toContainText("Batch completed");
});

test("checker rejects with a reason; executor sees no pay action", async ({ page }) => {
  await login(page, "checker");
  await page.goto("/batches?status=draft");
  await page.locator('[data-testid^="batch-row-"] a').first().click();
  await page.getByTestId("reject-batch").click();
  await page.getByTestId("confirm-action").click(); // empty reason → validation message
  await expect(page.getByText("at least 5 characters")).toBeVisible();
  await page.getByTestId("reject-reason").fill("Amounts don't match the payroll export");
  await page.getByTestId("confirm-action").click();
  await expect(page.getByTestId("batch-details")).toHaveAttribute("data-status", "rejected");
  await expect(page.getByTestId("rejection-reason")).toContainText("payroll export");
  await switchRole(page, "executor");
  await expect(page.getByTestId("pay-all")).toHaveCount(0);
});

test("MEXC batch with failing rows ends as completed with issues", async ({ page }) => {
  await login(page, "maker");
  await page.getByTestId("nav-newPayout").click();
  await page.getByTestId("channel-mexc").click();
  await page.getByTestId("file-input").setInputFiles(fixture("mexc-with-issues.xlsx"));
  await expect(page.getByTestId("validation-valid")).toBeVisible();
  await page.getByTestId("submit-batch").click();
  await expect(page).toHaveURL(/\/batches\/PO-\d+$/);
  await approveAsChecker(page);
  await switchRole(page, "executor");
  await page.getByTestId("pay-all").click();
  await page.getByTestId("confirm-action").click();
  const details = page.getByTestId("batch-details");
  await expect(details).toHaveAttribute("data-status", "completed_with_issues", { timeout: 45_000 });
  await expect(page.locator('[data-item-status="failed"]')).toHaveCount(1);
  await expect(page.locator('[data-item-status="requires_reconciliation"]')).toHaveCount(1);
});
