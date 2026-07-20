import { describe, expect, it } from "vitest";

describe("scaffold test harness", () => {
  it("runs in a browser-like environment without persisted learner state", () => {
    document.body.innerHTML = '<main data-testid="shell">healthy</main>';
    expect(document.querySelector('[data-testid="shell"]')?.textContent).toBe(
      "healthy",
    );
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
