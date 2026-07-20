import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { e2eArtifactPath } from "./evidence-root";

test.use({ trace: "off" });

const answers: Readonly<Record<string, string>> = {
  "3 * (x + 1) = 18": "5",
  "2 * (x + 4) = 14": "3",
  "4 * (x - 2) = 20": "7",
  "5 * x + 2 = 17": "3",
  "3 * x - 4 = 11": "5",
  "7 * x + 1 = 43": "6",
  "6 * x - 3 = 15": "3",
  "5 * x + 5 = 35": "6",
  "8 * x + 4 = 20": "2",
};

const fixtures = [
  {
    name: "distribution",
    load: "Load distribution example",
    repair: ["3 * x + 6 = 18", "3 * x = 12", "x = 4"],
    attempts: 2,
    category: "distribution",
  },
  {
    name: "equality",
    load: "Load equality example",
    repair: ["2 * x = 8", "x = 4"],
    attempts: 2,
    category: "equality preservation",
  },
  {
    name: "fully-valid",
    load: "Load fully valid example",
    repair: null,
    attempts: 1,
    category: null,
  },
] as const;

const buildEvidencePaths = [
  ".factory/product-spec.md",
  ".factory/architecture.md",
  ".factory/feature-plan.json",
  ".factory/verification.md",
  ".factory/reports/",
] as const;

async function completeFixture(
  page: Page,
  fixture: (typeof fixtures)[number],
  verifyIncorrect: boolean,
) {
  await page.getByRole("button", { name: fixture.load }).click();
  await expect(page.getByTestId("transfer-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "Check my reasoning" }).click();
  if (fixture.repair) {
    await expect(page.getByText("Minimal hint", { exact: true })).toBeVisible();
    for (const [index, value] of fixture.repair.entries())
      await page.getByLabel(`Step ${index + 2}`, { exact: true }).fill(value);
    await page.getByRole("button", { name: "Check my reasoning" }).click();
  }
  await expect(
    page.getByRole("heading", { name: "Valid complete solution" }),
  ).toBeVisible();
  const transfer = page.getByTestId("transfer-panel");
  await expect(transfer).toBeVisible();
  const equation = (await transfer.locator("code").first().textContent()) ?? "";
  const answer = answers[equation];
  expect(answer, `reviewed answer exists for ${equation}`).toBeTruthy();
  const response = transfer.getByLabel("Your value for x");
  if (verifyIncorrect) {
    await response.fill("999");
    await transfer
      .getByRole("button", { name: "Check transfer answer" })
      .click();
    await expect(transfer.getByText("Mastery: needs practice")).toBeVisible();
    await expect(transfer.getByTestId("learner-transfer-response")).toHaveText(
      "999",
    );
  }
  await response.fill(answer);
  await transfer.getByRole("button", { name: "Check transfer answer" }).click();
  await expect(transfer.getByText("Mastery: mastered")).toBeVisible();
  await expect(transfer.getByTestId("learner-transfer-response")).toHaveText(
    answer,
  );

  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  const evidence = page.getByTestId("evidence-view");
  await expect(evidence).toBeVisible();
  await expect(
    evidence.getByRole("heading", {
      name: `Attempt count: ${fixture.attempts}`,
    }),
  ).toBeVisible();
  await expect(evidence.getByText(equation, { exact: true })).toBeVisible();
  await expect(evidence.getByTestId("evidence-transfer-response")).toHaveText(
    answer,
  );
  await expect(evidence.getByTestId("evidence-mastery")).toHaveText("mastered");
  if (fixture.category) {
    await expect(evidence.getByTestId("evidence-first-invalid")).toHaveText(
      "2",
    );
    await expect(evidence.getByTestId("evidence-category")).toHaveText(
      fixture.category,
    );
    await expect(
      evidence.getByTestId("evidence-hint-provenance"),
    ).toContainText("no live model call");
  }
  await expect(evidence.getByRole("textbox")).toHaveCount(0);
  await expect(
    evidence.getByRole("button", { name: /reset|remove|check/i }),
  ).toHaveCount(0);
  const parityBefore = await evidence.textContent();
  const returnButton = evidence.getByRole("button", {
    name: "Return to learner",
  });
  await returnButton.focus();
  await page.keyboard.press("Enter");
  await expect(transfer).toBeVisible();
  await expect(transfer.getByText("Mastery: mastered")).toBeVisible();
  await page.getByRole("button", { name: "Evidence", exact: true }).click();
  expect(await evidence.textContent()).toBe(parityBefore);
  return { equation, answer };
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 360, height: 800 },
] as const) {
  test(`${viewport.name}: all no-key journeys reach mastery, evidence, and Build`, async ({
    page,
    context,
  }, testInfo) => {
    const providerRequests: string[] = [];
    const externalRequests: string[] = [];
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin !== "http://127.0.0.1:8080")
        externalRequests.push(request.url());
    });
    await page.route(
      /openai|anthropic|deepgram|api\/pedagogy|model|provider/iu,
      async (route) => {
        providerRequests.push(route.request().url());
        await route.abort();
      },
    );
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });
    try {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expect(page.getByText(/Education track/)).toBeVisible();
      for (const [index, fixture] of fixtures.entries()) {
        await completeFixture(page, fixture, index === 0);
        await page.screenshot({
          path: e2eArtifactPath(
            testInfo,
            `${viewport.name}-${fixture.name}-evidence.png`,
          ),
          fullPage: true,
        });
        await page.getByRole("button", { name: "Return to learner" }).click();
      }

      await page.getByRole("button", { name: "Build", exact: true }).click();
      const build = page.getByTestId("build-view");
      await expect(build).toContainText("GPT-5.6 Sol ultra");
      await expect(build).toContainText("Greenfield Software Factory skill");
      await expect(build).toContainText(
        "requirements → architecture → plan → implementation → independent review and repair",
      );
      await expect(build).toContainText("versioned static assets");
      await expect(build).toContainText("no live model or provider call");
      await page.screenshot({
        path: e2eArtifactPath(testInfo, `${viewport.name}-build.png`),
        fullPage: true,
      });

      const layout = await page.evaluate(() => ({
        bodyScrollWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        overflow: Array.from(document.querySelectorAll<HTMLElement>("body *"))
          .filter((element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.left < 0 || bounds.right > window.innerWidth;
          })
          .map((element) => ({
            tagName: element.tagName,
            text: element.textContent?.slice(0, 80),
          })),
      }));
      expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.overflow).toEqual([]);
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
      expect(await page.locator("body").textContent()).toContain("→");
      expect(providerRequests).toEqual([]);
      expect(externalRequests).toEqual([]);
      expect(browserErrors).toEqual([]);
    } finally {
      await context.tracing.stop({
        path: e2eArtifactPath(
          testInfo,
          `${viewport.name}-complete-loop-trace.zip`,
        ),
      });
    }
  });
}

test("Build keeps complete provenance readable and copyable at desktop, mobile, and 200% text", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Build", exact: true }).click();
  const build = page.getByTestId("build-view");

  for (const scenario of [
    { name: "desktop-normal", width: 1440, height: 900, fontSize: "100%" },
    { name: "mobile-normal", width: 360, height: 800, fontSize: "100%" },
    { name: "mobile-200-percent", width: 360, height: 800, fontSize: "200%" },
  ] as const) {
    await page.setViewportSize(scenario);
    await page.evaluate(
      (fontSize) => (document.documentElement.style.fontSize = fontSize),
      scenario.fontSize,
    );
    await expect(build).toBeVisible();
    await expect(build).toContainText("GPT-5.6 Sol ultra");
    await expect(build).toContainText("no live model or provider call");

    const paths = build.locator("code.build-evidence-path");
    await expect(paths).toHaveCount(buildEvidencePaths.length);
    for (const [index, expectedPath] of buildEvidencePaths.entries()) {
      const path = paths.nth(index);
      await expect(path).toBeVisible();
      await expect(path).toHaveText(expectedPath);
    }

    const layout = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>(
        "[data-testid='build-view']",
      );
      const paths = Array.from(
        document.querySelectorAll<HTMLElement>("code.build-evidence-path"),
      );
      const clipped = Array.from(
        root?.querySelectorAll<HTMLElement>(
          "h1, h2, p, li, code, nav, button",
        ) ?? [],
      )
        .filter(
          (element) =>
            element.scrollWidth > element.clientWidth + 1 ||
            element.getBoundingClientRect().left < -1 ||
            element.getBoundingClientRect().right > window.innerWidth + 1,
        )
        .map((element) => element.textContent?.trim().slice(0, 120));
      const blocks = Array.from(
        root?.querySelectorAll<HTMLElement>("h1, h2, p, li, button") ?? [],
      ).filter((element) => element.getClientRects().length > 0);
      const overlaps: string[] = [];
      for (let leftIndex = 0; leftIndex < blocks.length; leftIndex += 1) {
        const left = blocks[leftIndex].getBoundingClientRect();
        for (
          let rightIndex = leftIndex + 1;
          rightIndex < blocks.length;
          rightIndex += 1
        ) {
          const right = blocks[rightIndex].getBoundingClientRect();
          if (
            Math.min(left.right, right.right) -
              Math.max(left.left, right.left) >
              1 &&
            Math.min(left.bottom, right.bottom) -
              Math.max(left.top, right.top) >
              1
          )
            overlaps.push(
              `${blocks[leftIndex].tagName}:${blocks[leftIndex].textContent?.trim().slice(0, 40)} <> ${blocks[rightIndex].tagName}:${blocks[rightIndex].textContent?.trim().slice(0, 40)}`,
            );
        }
      }
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(paths[1]);
      selection?.removeAllRanges();
      selection?.addRange(range);
      const copiedText = selection?.toString() ?? "";
      selection?.removeAllRanges();
      return {
        bodyScrollWidth: document.body.scrollWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        clipped,
        overlaps,
        copiedText,
        paths: paths.map((element) => element.textContent),
      };
    });
    expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(layout.documentScrollWidth).toBeLessThanOrEqual(
      layout.viewportWidth,
    );
    expect(layout.clipped).toEqual([]);
    expect(layout.overlaps).toEqual([]);
    expect(layout.paths).toEqual(buildEvidencePaths);
    expect(layout.copiedText).toBe(".factory/architecture.md");

    const accessibility = await new AxeBuilder({ page })
      .include("[data-testid='build-view']")
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      path: e2eArtifactPath(testInfo, `${scenario.name}-build-wrap.png`),
      fullPage: true,
    });
  }
});

test("custom and edited seeded work derive transfer from accepted learner evidence", async ({
  page,
}) => {
  await page.goto("/");

  const enterCustomDistribution = async () => {
    await page.getByLabel("Starting problem").fill("5 * (x - 1) = 20");
    for (let index = 0; index < 3; index += 1)
      await page.getByRole("button", { name: "Add step" }).click();
    for (const [index, value] of [
      "5 * (x - 1) = 20",
      "5 * x - 5 = 20",
      "x = 5",
    ].entries())
      await page.getByLabel(`Step ${index + 1}`, { exact: true }).fill(value);
    await page.getByRole("button", { name: "Check my reasoning" }).click();
    const panel = page.getByTestId("transfer-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Same skill family: distribution");
    return (await panel.locator("code").textContent()) ?? "";
  };

  const firstEquation = await enterCustomDistribution();
  await page.reload();
  const repeatedEquation = await enterCustomDistribution();
  expect(repeatedEquation).toBe(firstEquation);

  await page.getByRole("button", { name: "Load equality example" }).click();
  await page.getByRole("button", { name: "Check my reasoning" }).click();
  await expect(page.getByText("Minimal hint", { exact: true })).toBeVisible();
  await page.getByLabel("Step 1", { exact: true }).fill("2 * x = 8");
  await page
    .getByRole("group", { name: "Equation line 3 controls" })
    .getByRole("button", { name: "Remove" })
    .click();
  await page.getByLabel("Step 2", { exact: true }).fill("x = 4");
  await page.getByRole("button", { name: "Check my reasoning" }).click();
  await expect(page.getByTestId("transfer-panel")).toContainText(
    "Same skill family: inverse operation",
  );

  await page.getByRole("button", { name: "Load fully valid example" }).click();
  await page.getByRole("button", { name: "Check my reasoning" }).click();
  await expect(page.getByTestId("transfer-panel")).toContainText(
    "Same skill family: inverse operation",
  );
  await page.getByRole("button", { name: "Load distribution example" }).click();
  await expect(page.getByTestId("transfer-panel")).toHaveCount(0);
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 360, height: 800 },
] as const) {
  test(`${viewport.name}: manual A to clean B never leaks stale diagnosis into learner or Evidence`, async ({
    page,
  }, testInfo) => {
    const providerRequests: string[] = [];
    await page.route(
      /openai|anthropic|deepgram|api\/pedagogy|model|provider/iu,
      async (route) => {
        providerRequests.push(route.request().url());
        await route.abort();
      },
    );
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("button", { name: "Load equality example" }).click();
    await page.getByRole("button", { name: "Check my reasoning" }).click();
    await expect(page.getByText("Minimal hint", { exact: true })).toBeVisible();

    await page.getByLabel("Starting problem").fill("5 * (x - 1) = 20");
    for (const [index, value] of [
      "5 * (x - 1) = 20",
      "5 * x - 5 = 20",
      "x = 5",
    ].entries())
      await page.getByLabel(`Step ${index + 1}`, { exact: true }).fill(value);
    await expect(page.getByText("Minimal hint", { exact: true })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Check my reasoning" }).click();

    const transfer = page.getByTestId("transfer-panel");
    await expect(transfer).toBeVisible();
    await expect(transfer).toContainText(
      "No false misconception was recorded for this completed solution.",
    );
    await expect(transfer.getByTestId("learner-diagnosis-summary")).toHaveCount(
      0,
    );
    await page.screenshot({
      path: e2eArtifactPath(testInfo, `${viewport.name}-clean-b-learner.png`),
      fullPage: true,
    });

    await page.getByRole("button", { name: "Evidence", exact: true }).click();
    const evidence = page.getByTestId("evidence-view");
    await expect(evidence).toContainText("Problem: 5 * (x - 1) = 20");
    await expect(evidence).toContainText(
      "No invalid transition has been recorded.",
    );
    await expect(evidence.getByTestId("evidence-first-invalid")).toHaveCount(0);
    await expect(evidence.getByTestId("evidence-hint-provenance")).toHaveCount(
      0,
    );
    const history = evidence.getByTestId("evidence-attempts");
    await expect(history).toContainText(
      "Historical problem snapshot: 2 * x + 3 = 11",
    );
    await expect(history).toContainText(
      "Historical problem snapshot: 5 * (x - 1) = 20",
    );
    await page.screenshot({
      path: e2eArtifactPath(testInfo, `${viewport.name}-clean-b-evidence.png`),
      fullPage: true,
    });

    await evidence.getByRole("button", { name: "Return to learner" }).click();
    await page.getByLabel("Starting problem").fill("2 * x + 3 = 11");
    for (const [index, value] of [
      "2 * x + 3 = 11",
      "2 * x = 8",
      "x = 4",
    ].entries())
      await page.getByLabel(`Step ${index + 1}`, { exact: true }).fill(value);
    await page.getByRole("button", { name: "Check my reasoning" }).click();
    await expect(page.getByTestId("transfer-panel")).toContainText(
      "Same skill family: inverse operation",
    );
    await expect(page.getByTestId("learner-diagnosis-summary")).toHaveCount(0);
    await page.getByRole("button", { name: "Evidence", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Attempt count: 3" }),
    ).toBeVisible();
    await expect(page.getByTestId("evidence-view")).toContainText(
      "No invalid transition has been recorded.",
    );
    await expect(page.getByTestId("evidence-category")).toHaveCount(0);
    await expect(page.getByTestId("evidence-hint-provenance")).toHaveCount(0);
    await page.screenshot({
      path: e2eArtifactPath(
        testInfo,
        `${viewport.name}-a-b-a-clean-evidence.png`,
      ),
      fullPage: true,
    });
    expect(providerRequests).toEqual([]);
  });
}
