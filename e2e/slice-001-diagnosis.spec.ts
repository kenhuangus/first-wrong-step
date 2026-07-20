import { expect, test } from "@playwright/test";
test("real shell finds only the first wrong step with model traffic blocked", async ({
  page,
}, testInfo) => {
  const modelRequests: string[] = [];
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.route(
    /openai|anthropic|deepgram|api\/pedagogy/iu,
    async (route) => {
      modelRequests.push(route.request().url());
      await route.abort();
    },
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Load distribution example" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByLabel("Step 4").fill("x = 999");
  await page.getByRole("button", { name: "Check my reasoning" }).click();
  await expect(
    page.getByRole("heading", { name: "Review step 2" }),
  ).toBeVisible();
  const liveDiagnosis = page.getByRole("status");
  await expect(liveDiagnosis).toHaveAttribute("aria-live", "polite");
  await expect(liveDiagnosis).toHaveAttribute("aria-atomic", "true");
  await expect(liveDiagnosis).toHaveText(
    "First wrong step found. Review step 2.",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("distribution", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Not evaluated yet", { exact: true }),
  ).toHaveCount(2);
  await expect(page.getByText(/transfer|mastered/iu)).toHaveCount(0);
  expect(modelRequests).toEqual([]);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("diagnosis-1440x900.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("diagnosis-360x800.png"),
    fullPage: true,
  });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await expect(
    page.getByRole("heading", { name: "Review step 2" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check my reasoning" }),
  ).toBeVisible();
  const textScaleMetrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    viewportWidth: window.innerWidth,
    rootFontSize: getComputedStyle(document.documentElement).fontSize,
  }));
  expect(textScaleMetrics.scrollWidth).toBeLessThanOrEqual(
    textScaleMetrics.clientWidth,
  );
  await testInfo.attach("text-200-percent-metrics.json", {
    body: JSON.stringify(textScaleMetrics, null, 2),
    contentType: "application/json",
  });
  await page.screenshot({
    path: testInfo.outputPath("diagnosis-360x800-text-200-percent.png"),
    fullPage: true,
  });
  expect(browserErrors).toEqual([]);
});
test.describe("solution-set boundary routes", () => {
  for (const boundary of [
    {
      name: "No solution",
      problem: "2*x+1=2*x+2",
      steps: ["1=2", "3=4", "5=6", "7=8"],
    },
    {
      name: "All real numbers",
      problem: "2*(x+1)=2*x+2",
      steps: ["2*x+2=2*x+2", "0=0", "4=4", "x=x"],
    },
  ]) {
    test(boundary.name, async ({ page }) => {
      await page.goto("/");
      await page
        .getByRole("button", { name: "Load distribution example" })
        .click();
      await page.getByLabel("Starting problem").fill(boundary.problem);
      await page.getByLabel("Step 1").fill(boundary.steps[0]);
      await page.getByLabel("Step 2").fill(boundary.steps[1]);
      await page.getByLabel("Step 3").fill(boundary.steps[2]);
      await page.getByLabel("Step 4").fill(boundary.steps[3]);
      await page.getByRole("button", { name: "Check my reasoning" }).click();
      await expect(
        page.getByRole("heading", { name: boundary.name }),
      ).toBeVisible();
      await expect(page.getByText(/transfer|mastered/iu)).toHaveCount(0);
    });
  }
});
