import { expect, test } from "@playwright/test";

test("ordered repair, history, and fallback work with provider traffic denied", async ({
  page,
}, testInfo) => {
  const providerRequests: string[] = [];
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.route(
    /openai|anthropic|deepgram|api\/pedagogy/iu,
    async (route) => {
      providerRequests.push(route.request().url());
      await route.abort();
    },
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Load equality example" }).click();
  await page.getByRole("button", { name: "Check my reasoning" }).click();
  await expect(
    page.getByRole("heading", { name: "Review step 2" }),
  ).toBeVisible();
  await expect(page.getByText("Minimal hint", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Load fully valid example" }).click();
  await page.getByRole("button", { name: "Check my reasoning" }).click();
  await expect(
    page.getByRole("heading", { name: "Valid complete solution" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Load distribution example" }).click();
  await expect(page.getByText("4 steps", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add step" }).click();
  await page.getByLabel("Step 5").fill("x = 42");
  await page
    .getByRole("group", { name: "Equation line 5 controls" })
    .getByRole("button", { name: "Move up" })
    .click();
  await expect(page.getByLabel("Step 4")).toHaveValue("x = 42");
  await page
    .getByRole("group", { name: "Equation line 4 controls" })
    .getByRole("button", { name: "Move down" })
    .click();
  await page
    .getByRole("group", { name: "Equation line 5 controls" })
    .getByRole("button", { name: "Remove" })
    .click();
  await expect(page.getByText("4 steps", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Check my reasoning" }).click();
  await expect(page.getByText("Minimal hint", { exact: true })).toBeVisible();
  await expect(page.getByText(/reviewed judge fixture/i)).toBeVisible();
  await expect(page.getByText(/no live model call/i)).toBeVisible();
  await expect(page.getByText("Attempt 1", { exact: true })).toBeVisible();

  await page
    .getByRole("textbox", { name: "Step 2", exact: true })
    .fill("3 * x + 6 = 18");
  await page
    .getByRole("textbox", { name: "Step 3", exact: true })
    .fill("3 * x = 12");
  await page
    .getByRole("textbox", { name: "Step 4", exact: true })
    .fill("x = 4");
  await page.getByRole("button", { name: "Check my reasoning" }).click();
  await expect(
    page.getByRole("heading", { name: "Valid complete solution" }),
  ).toBeVisible();
  await expect(page.getByText("Attempt 2", { exact: true })).toBeVisible();
  await expect(page.getByText(/3 \* x \+ 2 = 18/)).toBeVisible();
  const attemptOne = page
    .getByRole("listitem")
    .filter({ has: page.getByText("Attempt 1", { exact: true }) });
  await expect(attemptOne.getByText("Outcome", { exact: true })).toBeVisible();
  await expect(
    attemptOne.getByText("Equations", { exact: true }),
  ).toBeVisible();
  await expect(attemptOne).not.toContainText("Attempt 1needs repair");
  await expect(attemptOne.locator(".attempt-history-equations")).toContainText(
    "3 * x + 2 = 18",
  );

  await page
    .getByRole("textbox", { name: "Step 2", exact: true })
    .fill("x = 100");
  await page.getByRole("button", { name: "Check my reasoning" }).click();
  await expect(
    page.getByText("Reviewed fallback hint", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry hint once" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry hint once" }).click();
  await expect(page.getByText(/Retry limit reached/)).toBeVisible();
  await expect(page.getByText("Attempt 3", { exact: true })).toBeVisible();
  await expect(page.getByText("Attempt 4", { exact: true })).toHaveCount(0);

  await expect(
    page.getByText("Education track · private judge mode", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/exact same solution set—and stop/),
  ).toBeVisible();
  expect(
    await page.evaluate(() => ({
      cookies: document.cookie,
      localStorageKeys: Object.keys(localStorage),
      sessionStorageKeys: Object.keys(sessionStorage),
    })),
  ).toEqual({
    cookies: "",
    localStorageKeys: [],
    sessionStorageKeys: [],
  });

  expect(providerRequests).toEqual([]);
  expect(browserErrors).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("repair-fallback-1440x900.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.left < 0 || bounds.right > window.innerWidth;
        })
        .map((element) => ({
          className: element.className,
          tagName: element.tagName,
          text: element.textContent?.slice(0, 80),
        })),
    ),
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("repair-fallback-360x800.png"),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  expect(
    await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.left < 0 || bounds.right > window.innerWidth;
        })
        .map((element) => ({
          className: element.className,
          tagName: element.tagName,
          text: element.textContent?.slice(0, 80),
        })),
    ),
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("repair-fallback-360x800-200-percent.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Reset work" }).click();
  await expect(
    page.getByRole("alertdialog", { name: "Confirm reset" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep working" }).click();
  await expect(page.getByText("Attempt 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset work" }).click();
  await page.getByRole("button", { name: "Confirm reset" }).click();
  await expect(page.getByText("0 steps", { exact: true })).toBeVisible();
  await expect(page.getByText("Attempt 1", { exact: true })).toHaveCount(0);
});
