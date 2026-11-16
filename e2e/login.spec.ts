import { expect, test } from "@playwright/test";
import { logInAs } from "./support";

test("a logged-out visit to / lands on the login page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
});

test("logging in as alice shows the app shell with her name", async ({
  page,
}) => {
  await logInAs(page, "alice");

  await expect(page.getByText("Alice", { exact: true })).toBeVisible();
});

test("refreshing keeps you logged in", async ({ page }) => {
  await logInAs(page, "alice");
  await expect(page.getByText("My documents")).toBeVisible();

  await page.reload();

  await expect(page.getByText("My documents")).toBeVisible();
});

test("logging out returns to /login and protects / again", async ({ page }) => {
  await logInAs(page, "alice");
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
});
