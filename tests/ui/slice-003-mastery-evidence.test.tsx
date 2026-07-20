import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/ui/App";

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

const cases = [
  {
    load: "Load distribution example",
    repair: ["3 * x + 6 = 18", "3 * x = 12", "x = 4"],
    attempts: 2,
    category: "distribution",
  },
  {
    load: "Load equality example",
    repair: ["2 * x = 8", "x = 4"],
    attempts: 2,
    category: "equality preservation",
  },
  {
    load: "Load fully valid example",
    repair: null,
    attempts: 1,
    category: null,
  },
] as const;

async function completeCase(testCase: (typeof cases)[number]) {
  fireEvent.click(screen.getByRole("button", { name: testCase.load }));
  expect(screen.queryByTestId("transfer-panel")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Check my reasoning" }));
  if (testCase.repair) {
    await screen.findByText("Minimal hint", {}, { timeout: 3_000 });
    testCase.repair.forEach((value, index) => {
      fireEvent.change(screen.getByLabelText(`Step ${index + 2}`), {
        target: { value },
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Check my reasoning" }));
  }
  expect(
    await screen.findByRole("heading", { name: "Valid complete solution" }),
  ).toBeDefined();
  const transfer = await screen.findByTestId("transfer-panel");
  const equation = within(transfer).getByText((_, element) =>
    Boolean(element?.tagName === "CODE" && answers[element.textContent ?? ""]),
  ).textContent;
  fireEvent.change(within(transfer).getByLabelText("Your value for x"), {
    target: { value: answers[equation] },
  });
  fireEvent.click(
    within(transfer).getByRole("button", { name: "Check transfer answer" }),
  );
  expect(within(transfer).getByText("Mastery: mastered")).toBeDefined();
  return { equation, answer: answers[equation] };
}

describe("SLICE-003 mastery, evidence, and Build UI", () => {
  it.each(cases)(
    "completes $load through transfer and read-only parity",
    async (testCase) => {
      render(<App />);
      const completed = await completeCase(testCase);
      if (testCase.category)
        expect(screen.getByText("Repairs attempt 1")).toBeDefined();
      fireEvent.click(screen.getByRole("button", { name: "Evidence" }));
      const evidence = screen.getByTestId("evidence-view");
      expect(
        within(evidence).getByRole("heading", {
          name: `Attempt count: ${testCase.attempts}`,
        }),
      ).toBeDefined();
      expect(within(evidence).getByText(completed.equation)).toBeDefined();
      expect(
        within(evidence).getByTestId("evidence-transfer-response").textContent,
      ).toBe(completed.answer);
      expect(within(evidence).getByTestId("evidence-mastery").textContent).toBe(
        "mastered",
      );
      if (testCase.category) {
        expect(evidence.textContent).toContain("repairs attempt 1");
        expect(
          within(evidence).getByTestId("evidence-first-invalid").textContent,
        ).toBe("2");
        expect(
          within(evidence).getByTestId("evidence-category").textContent,
        ).toBe(testCase.category);
        expect(
          within(evidence).getByTestId("evidence-hint-provenance").textContent,
        ).toContain("no live model call");
      }
      expect(within(evidence).queryAllByRole("textbox")).toHaveLength(0);
      expect(evidence.textContent).toContain("Historical problem snapshot:");
      expect(
        within(evidence).queryByRole("button", { name: /reset|remove|check/i }),
      ).toBeNull();
      fireEvent.keyDown(evidence, { key: "Enter" });
      expect(within(evidence).getByTestId("evidence-mastery").textContent).toBe(
        "mastered",
      );
      fireEvent.click(
        within(evidence).getByRole("button", { name: "Return to learner" }),
      );
      expect(screen.getByText("Mastery: mastered")).toBeDefined();
      expect(screen.getByTestId("learner-transfer-response").textContent).toBe(
        completed.answer,
      );
    },
  );

  it("keeps an interrupted equality diagnosis historical after A to B to clean A", async () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "Load equality example" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Check my reasoning" }));
    await screen.findByText("Minimal hint", {}, { timeout: 3_000 });

    fireEvent.change(screen.getByLabelText("Starting problem"), {
      target: { value: "5 * (x - 1) = 20" },
    });
    for (const [index, value] of [
      "5 * (x - 1) = 20",
      "5 * x - 5 = 20",
      "x = 5",
    ].entries())
      fireEvent.change(screen.getByLabelText(`Step ${index + 1}`), {
        target: { value },
      });
    fireEvent.click(screen.getByRole("button", { name: "Check my reasoning" }));
    await screen.findByRole("heading", { name: "Valid complete solution" });

    fireEvent.change(screen.getByLabelText("Starting problem"), {
      target: { value: "2 * x + 3 = 11" },
    });
    for (const [index, value] of [
      "2 * x + 3 = 11",
      "2 * x = 8",
      "x = 4",
    ].entries())
      fireEvent.change(screen.getByLabelText(`Step ${index + 1}`), {
        target: { value },
      });
    fireEvent.click(screen.getByRole("button", { name: "Check my reasoning" }));

    const transfer = await screen.findByTestId("transfer-panel");
    expect(transfer.textContent).toContain(
      "Same skill family: inverse operation",
    );
    expect(
      within(transfer).queryByTestId("learner-diagnosis-summary"),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Evidence" }));
    const evidence = screen.getByTestId("evidence-view");
    expect(evidence.textContent).toContain("Attempt count: 3");
    expect(evidence.textContent).toContain(
      "No invalid transition has been recorded.",
    );
    expect(within(evidence).queryByTestId("evidence-category")).toBeNull();
    expect(
      within(evidence).queryByTestId("evidence-hint-provenance"),
    ).toBeNull();
  });

  it("states dated factual Codex, GPT-5.6 Sol ultra, factory, static asset, and no-live-call provenance", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Build" }));
    const build = screen.getByTestId("build-view");
    expect(build.textContent).toContain("2026-07-20");
    expect(build.textContent).toContain("Codex");
    expect(build.textContent).toContain("GPT-5.6 Sol ultra");
    expect(build.textContent).toContain("Greenfield Software Factory skill");
    expect(build.textContent).toContain("user created and refined");
    expect(build.textContent).toContain(
      "requirements → architecture → plan → implementation → independent review and repair",
    );
    expect(build.textContent).toContain("versioned static assets");
    expect(build.textContent).toContain("no live model or provider call");
    expect(build.textContent).toContain(".factory/product-spec.md");
    expect(build.textContent).toContain(".factory/reports/");
    const pathElements = Array.from(build.querySelectorAll("code"));
    const paths = pathElements.map((element) => element.textContent);
    expect(paths).toEqual([
      ".factory/product-spec.md",
      ".factory/architecture.md",
      ".factory/feature-plan.json",
      ".factory/verification.md",
      ".factory/reports/",
    ]);
    for (const path of pathElements) {
      expect(path.classList.contains("build-evidence-path")).toBe(true);
      expect(path.hasAttribute("title")).toBe(false);
      expect(path.textContent).not.toContain("â€¦");
    }
  });
});
