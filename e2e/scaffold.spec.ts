import { expect, test } from "@playwright/test";

test("serves the healthy scaffold route", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "First Wrong Step" }),
  ).toBeVisible();
  await expect(page.getByLabel("Privacy note")).toContainText("synthetic");
});

test("loads the declared favicon without a browser error", async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedIconRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (new URL(request.url()).pathname.includes("favicon"))
      failedIconRequests.push(request.url());
  });

  await page.goto("/");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    "/favicon.svg",
  );
  const iconResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/favicon.svg",
  );
  await page.evaluate(async () => {
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) throw new Error("Expected a declared icon.");
    const response = await fetch(icon.href);
    if (!response.ok)
      throw new Error(`Icon request failed: ${response.status}`);
  });
  const response = await iconResponse;

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/svg+xml");
  expect(failedIconRequests).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
