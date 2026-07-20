import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PedagogyAdapter } from "../../src/contracts/pedagogy";
import { App } from "../../src/ui/App";

describe("SLICE-002 learner repair UI", () => {
  const reviewedResponse = (
    category: "distribution" | "equality_preservation",
    marker?: "newest",
  ) => ({
    kind: "content" as const,
    result: {
      content:
        category === "distribution"
          ? {
              category,
              hint:
                marker === "newest"
                  ? "Inspect the newest outside factor check for each term."
                  : "Inspect how the outside factor applies to each term.",
              explanation: "The distributive property scales each term.",
            }
          : {
              category,
              hint: "Check whether this move keeps both sides balanced.",
              explanation:
                "Every transformation must preserve the solution set.",
            },
      provenance: "reviewed judge fixture" as const,
      status: "ready" as const,
      retryable: false,
    },
  });

  const failureResponse = {
    kind: "failure" as const,
    code: "timeout" as const,
    retryable: true,
  };

  function deferredAdapter() {
    const calls: Array<{
      signal: AbortSignal;
      category: "distribution" | "equality_preservation";
      resolve: (
        value: ReturnType<typeof reviewedResponse> | typeof failureResponse,
      ) => void;
    }> = [];
    const adapter: PedagogyAdapter = {
      getPedagogy(evidence, signal) {
        return new Promise((resolve) => {
          calls.push({
            signal,
            category: evidence.category as
              "distribution" | "equality_preservation",
            resolve,
          });
        });
      },
    };
    return { adapter, calls };
  }

  it("renders the reviewed UTF-8 punctuation exactly", async () => {
    render(<App />);
    expect(
      screen.getByText("Education track · private judge mode"),
    ).toBeDefined();
    expect(
      screen.getByText(
        "Check whether each algebra move preserves the exact same solution set—and stop at the first one that does not.",
      ),
    ).toBeDefined();
    expect(screen.getByText("Deterministic · local")).toBeDefined();
    fireEvent.click(
      screen.getByRole("button", { name: /load distribution example/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /check my reasoning/i }),
    );
    await screen.findByText("Minimal hint");
    expect(screen.getByText(/ → /u)).toBeDefined();
  });
  it("adds, edits, moves, and removes ordered steps visibly", () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /load distribution example/i }),
    );
    expect(screen.getByText("4 steps")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    expect(screen.getByText("5 steps")).toBeDefined();
    fireEvent.change(screen.getByLabelText("Step 5"), {
      target: { value: "x = 42" },
    });
    const stepFiveActions = screen.getByRole("group", {
      name: "Equation line 5 controls",
    });
    fireEvent.click(
      within(stepFiveActions).getByRole("button", { name: "Move up" }),
    );
    expect(screen.getByLabelText<HTMLInputElement>("Step 4").value).toBe(
      "x = 42",
    );
    const stepFourActions = screen.getByRole("group", {
      name: "Equation line 4 controls",
    });
    fireEvent.click(
      within(stepFourActions).getByRole("button", { name: "Move down" }),
    );
    expect(screen.getByLabelText<HTMLInputElement>("Step 5").value).toBe(
      "x = 42",
    );
    fireEvent.click(
      within(
        screen.getByRole("group", { name: "Equation line 5 controls" }),
      ).getByRole("button", { name: "Remove" }),
    );
    expect(screen.getByText("4 steps")).toBeDefined();
    expect(screen.queryByDisplayValue("x = 42")).toBeNull();
  });

  it("diagnoses, hints, repairs, rechecks, and retains prior immutable work", async () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /load distribution example/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /check my reasoning/i }),
    );
    expect(await screen.findByText("Minimal hint")).toBeDefined();
    expect(screen.getByText(/reviewed judge fixture/i)).toBeDefined();
    expect(screen.getByText(/no live model call/i)).toBeDefined();
    expect(screen.getByText("Attempt 1")).toBeDefined();

    fireEvent.change(screen.getByLabelText("Step 2"), {
      target: { value: "3 * x + 6 = 18" },
    });
    expect(screen.queryByText("Minimal hint")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: /check my reasoning/i }),
    );
    expect(
      await screen.findByText(
        (_content, element) =>
          element?.tagName === "H2" && element.textContent === "Review step 3",
      ),
    ).toBeDefined();
    expect(screen.getByText("Attempt 2")).toBeDefined();
    expect(screen.getByText(/3 \* x \+ 2 = 18/)).toBeDefined();
    expect(screen.getByText(/3 \* x \+ 6 = 18/)).toBeDefined();

    const attemptOne = screen.getByText("Attempt 1").closest("li");
    expect(attemptOne).not.toBeNull();
    expect(within(attemptOne!).getByText("Outcome")).toBeDefined();
    expect(within(attemptOne!).getByText("needs repair")).toBeDefined();
    expect(within(attemptOne!).getByText("Equations")).toBeDefined();
    expect(attemptOne!.textContent).not.toContain("Attempt 1needs repair");
    expect(
      attemptOne!.querySelector(".attempt-history-equations")?.textContent,
    ).toContain("3 * x + 2 = 18");
  });

  it("preserves work, avoids duplicate attempts, and permits only one retry on failure", async () => {
    let calls = 0;
    const adapter: PedagogyAdapter = {
      getPedagogy() {
        calls += 1;
        return Promise.resolve({
          kind: "failure" as const,
          code: "timeout" as const,
          retryable: true,
        });
      },
    };
    render(<App pedagogyAdapter={adapter} />);
    fireEvent.click(
      screen.getByRole("button", { name: /load distribution example/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /check my reasoning/i }),
    );
    expect(await screen.findByText("Reviewed fallback hint")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toContain("timeout");
    expect(screen.getByLabelText<HTMLInputElement>("Step 2").value).toBe(
      "3 * x + 2 = 18",
    );
    expect(screen.getAllByText(/^Attempt 1$/)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Retry hint once" }));
    expect(await screen.findByText(/Retry limit reached/)).toBeDefined();
    expect(calls).toBe(2);
    expect(screen.getAllByText(/^Attempt 1$/)).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "Retry hint once" }),
    ).toBeNull();
  });

  it("reaches fully valid, unsupported, and reset-confirmation recovery states", async () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /load fully valid example/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /check my reasoning/i }),
    );
    expect(
      await screen.findByRole("heading", { name: "Valid complete solution" }),
    ).toBeDefined();
    fireEvent.change(screen.getByLabelText("Step 1"), {
      target: { value: "y = 2" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /check my reasoning/i }),
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Only the variable x",
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset work" }));
    expect(
      screen.getByRole("alertdialog", { name: "Confirm reset" }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Keep working" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reset work" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm reset" }));
    expect(screen.getByText("0 steps")).toBeDefined();
    expect(screen.queryByText("Attempt 1")).toBeNull();
  });

  it("shows loading and rejects active content before it reaches the DOM", async () => {
    let release: () => void = () => {};
    const adapter: PedagogyAdapter = {
      getPedagogy() {
        return new Promise((resolve) => {
          release = () =>
            resolve({
              kind: "content",
              result: {
                content: {
                  category: "distribution",
                  hint: "<a href='https://bad.example'>factor</a>",
                  explanation: "The factor applies to each term.",
                },
                provenance: "GPT-5.6-assisted",
                status: "ready",
                retryable: false,
              },
            });
        });
      },
    };
    const { container } = render(<App pedagogyAdapter={adapter} />);
    fireEvent.click(
      screen.getByRole("button", { name: /load distribution example/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /check my reasoning/i }),
    );
    expect(screen.getByText(/Loading a safe hint/)).toBeDefined();
    act(() => release());
    expect(await screen.findByText("Reviewed fallback hint")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toContain("invalid output");
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).not.toContain("bad.example");
  });

  it.each(["reset", "fixture switch", "step edit"] as const)(
    "aborts and ignores a stale success after %s",
    async (invalidation) => {
      const { adapter, calls } = deferredAdapter();
      render(<App pedagogyAdapter={adapter} />);
      fireEvent.click(
        screen.getByRole("button", { name: /load distribution example/i }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: /check my reasoning/i }),
      );
      expect(await screen.findByText("Loading a safe hint…")).toBeDefined();
      expect(calls).toHaveLength(1);
      if (invalidation === "reset") {
        fireEvent.click(screen.getByRole("button", { name: "Reset work" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirm reset" }));
      } else if (invalidation === "fixture switch") {
        fireEvent.click(
          screen.getByRole("button", { name: /load equality example/i }),
        );
      } else {
        fireEvent.change(screen.getByLabelText("Step 2"), {
          target: { value: "3 * x + 6 = 18" },
        });
      }
      expect(calls[0].signal.aborted).toBe(true);
      act(() => calls[0].resolve(reviewedResponse("distribution")));
      expect(screen.queryByText("Minimal hint")).toBeNull();
      expect(screen.queryByText("Loading a safe hint…")).toBeNull();
    },
  );

  it("commits only the newest analysis when completions arrive out of order", async () => {
    const { adapter, calls } = deferredAdapter();
    render(<App pedagogyAdapter={adapter} />);
    fireEvent.click(
      screen.getByRole("button", { name: /load distribution example/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /check my reasoning/i }),
    );
    await screen.findByText("Loading a safe hint…");
    fireEvent.change(screen.getByLabelText("Step 4"), {
      target: { value: "x = 99" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /check my reasoning/i }),
    );
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0].signal.aborted).toBe(true);
    act(() => calls[1].resolve(failureResponse));
    expect(await screen.findByText("Reviewed fallback hint")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toContain("timeout");
    act(() => calls[0].resolve(reviewedResponse("distribution")));
    expect(screen.getByText("Reviewed fallback hint")).toBeDefined();
    expect(screen.queryByText(/how the outside factor applies/i)).toBeNull();
    expect(screen.getAllByText(/^Attempt [12]$/)).toHaveLength(2);
  });

  it("single-flights retry and aborts it on reset", async () => {
    let calls = 0;
    let retrySignal: AbortSignal | undefined;
    let resolveRetry:
      ((value: ReturnType<typeof reviewedResponse>) => void) | undefined;
    const adapter: PedagogyAdapter = {
      getPedagogy(_evidence, signal) {
        calls += 1;
        if (calls === 1)
          return Promise.resolve({
            kind: "failure" as const,
            code: "timeout" as const,
            retryable: true,
          });
        retrySignal = signal;
        return new Promise((resolve) => {
          resolveRetry = resolve;
        });
      },
    };
    render(<App pedagogyAdapter={adapter} />);
    fireEvent.click(
      screen.getByRole("button", { name: /load distribution example/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /check my reasoning/i }),
    );
    const retry = await screen.findByRole("button", {
      name: "Retry hint once",
    });
    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(calls).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Reset work" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm reset" }));
    expect(retrySignal?.aborted).toBe(true);
    act(() => resolveRetry?.(reviewedResponse("distribution")));
    expect(screen.queryByText("Minimal hint")).toBeNull();
    expect(screen.getByText("0 steps")).toBeDefined();
  });

  it("aborts pending work on unmount and suppresses duplicate attempts", async () => {
    const { adapter, calls } = deferredAdapter();
    const view = render(<App pedagogyAdapter={adapter} />);
    fireEvent.click(
      screen.getByRole("button", { name: /load distribution example/i }),
    );
    const check = screen.getByRole("button", { name: /check my reasoning/i });
    fireEvent.click(check);
    fireEvent.click(check);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(screen.getAllByText("Attempt 1")).toHaveLength(1);
    view.unmount();
    expect(calls[0].signal.aborted).toBe(true);
    act(() => calls[0].resolve(reviewedResponse("distribution")));
  });
});
