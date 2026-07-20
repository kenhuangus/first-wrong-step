import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/ui/App";
describe("SLICE-001 learner shell", () => {
  it("shows the first invalid transition and later not-evaluated states", () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /load distribution example/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /check my reasoning/i }),
    );
    expect(
      screen.getByRole("heading", { name: "Review step 2" }),
    ).toBeDefined();
    expect(screen.getByText("distribution")).toBeDefined();
    const liveDiagnosis = screen.getByRole("status");
    expect(liveDiagnosis.getAttribute("aria-live")).toBe("polite");
    expect(liveDiagnosis.getAttribute("aria-atomic")).toBe("true");
    expect(liveDiagnosis.textContent).toBe(
      "First wrong step found. Review step 2.",
    );
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByText("Not evaluated yet")).toHaveLength(2);
    expect(screen.queryByText(/transfer/i)).toBeNull();
    expect(screen.queryByText(/mastered/i)).toBeNull();
  });
  it("renders an unsupported input without a misconception", () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /load distribution example/i }),
    );
    fireEvent.change(screen.getByLabelText("Step 1"), {
      target: { value: "y=2" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /check my reasoning/i }),
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Only the variable x",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "No mathematical misconception",
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
  it("preserves an over-limit edit after rejection", () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /load distribution example/i }),
    );
    const input = screen.getByLabelText<HTMLInputElement>("Step 1");
    const value = `x=1${" ".repeat(254)}`;
    fireEvent.change(input, { target: { value } });
    fireEvent.click(
      screen.getByRole("button", { name: /check my reasoning/i }),
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Input too complex",
    );
    expect(input.value).toBe(value);
  });
  it("renders a cancelling variable denominator as unsupported without misconception", () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /load distribution example/i }),
    );
    fireEvent.change(screen.getByLabelText("Step 1"), {
      target: { value: "x/(x-x+2)=1" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /check my reasoning/i }),
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "constant that does not contain x",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "No mathematical misconception",
    );
  });
  it("renders an exact fractional isolated form as valid complete", () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: /load distribution example/i }),
    );
    fireEvent.change(screen.getByLabelText("Starting problem"), {
      target: { value: "2*x=1" },
    });
    for (let step = 1; step <= 4; step += 1) {
      fireEvent.change(screen.getByLabelText(`Step ${step}`), {
        target: { value: "x=1/2" },
      });
    }
    fireEvent.click(
      screen.getByRole("button", { name: /check my reasoning/i }),
    );
    expect(
      screen.getByRole("heading", { name: "Valid complete solution" }),
    ).toBeDefined();
    expect(screen.queryByText(/misconception category/iu)).toBeNull();
  });
});
