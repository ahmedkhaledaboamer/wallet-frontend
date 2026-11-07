import { expect, type Page } from "@playwright/test";
import path from "node:path";

export const fixture = (name: string) => path.join(__dirname, "fixtures", name);

export type Role = "maker" | "checker" | "executor";

export async function login(page: Page, role: Role, locale: "en" | "ar" = "en") {
  await page.goto("/login");
  await page.evaluate((l) => localStorage.setItem("apx.locale", l), locale);
  await page.reload();
  await page.getByTestId(`login-${role}`).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("role-switcher")).toBeVisible();
}

export async function switchRole(page: Page, role: Role) {
  await page.getByTestId("role-switcher").click();
  await page.getByTestId(`switch-role-${role}`).click();
  await expect(page.getByTestId("role-switcher")).toContainText(new RegExp(role, "i"));
}

/** Maker uploads a fixture for a channel and creates the batch; returns the new batch id. */
export async function createBatch(page: Page, channel: "mexc" | "trust_wallet", file: string): Promise<string> {
  await page.getByTestId("nav-newPayout").click();
  await page.getByTestId(`channel-${channel}`).click();
  await page.getByTestId("file-input").setInputFiles(fixture(file));
  await expect(page.getByTestId("validation-valid")).toBeVisible();
  await page.getByTestId("submit-batch").click();
  await expect(page).toHaveURL(/\/batches\/PO-\d+$/);
  const id = decodeURIComponent(page.url().split("/").pop()!);
  await expect(page.getByTestId("batch-details")).toHaveAttribute("data-status", "draft");
  return id;
}

export async function approveAsChecker(page: Page) {
  await switchRole(page, "checker");
  await page.getByTestId("approve-batch").click();
  await page.getByTestId("confirm-action").click();
  await expect(page.getByTestId("batch-details")).toHaveAttribute("data-status", "approved");
}
