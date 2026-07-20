import { describe, expect, it } from "vitest";
import { analyze } from "../../src/domain/analyze";
describe("first wrong step analysis", () => {
  it.each([
    { label: "empty", steps: ["x=2", ""], line: 2, code: "empty" },
    { label: "malformed", steps: ["x=2", "x="], line: 2, code: "malformed" },
    { label: "nonlinear", steps: ["x=2", "x*x=4"], line: 2, code: "nonlinear" },
    {
      label: "second variable",
      steps: ["x=2", "y=2"],
      line: 2,
      code: "second_variable",
    },
    {
      label: "zero denominator",
      steps: ["x=2", "x/(1-1)=2"],
      line: 2,
      code: "zero_denominator",
    },
    {
      label: "cancelling variable denominator",
      steps: ["x=2", "x/(x-x+2)=1"],
      line: 2,
      code: "variable_denominator",
    },
  ])(
    "reports earliest $label line without misconception",
    ({ steps, line, code }) => {
      const result = analyze({ problem: "x=2", steps });
      expect(result.kind).toBe("input_error");
      if (result.kind !== "input_error") return;
      expect(result.lines[line]).toMatchObject({
        kind: "unsupported",
        lineIndex: line,
        code,
      });
      expect(result.lines.some((item) => item.kind === "invalid")).toBe(false);
    },
  );
  it("recognizes a bounded property table of exact fractional isolated forms", () => {
    for (let numerator = -3; numerator <= 3; numerator += 1) {
      if (numerator === 0) continue;
      for (let denominator = 2; denominator <= 5; denominator += 1) {
        expect(
          analyze({
            problem: `${denominator}*x=${numerator}`,
            steps: [`x=${numerator}/${denominator}`],
          }).kind,
        ).toBe("valid_complete");
      }
    }
  });
  it("reports only the earliest invalid transition on ten repeats", () => {
    for (let run = 0; run < 10; run += 1) {
      const result = analyze({
        problem: "3*(x+2)=18",
        steps: ["3*(x+2)=18", "3*x+2=18", "3*x=16", "x=99", "broken later"],
      });
      expect(result.kind).toBe("needs_repair");
      if (result.kind !== "needs_repair") continue;
      expect(result.firstInvalidIndex).toBe(2);
      expect(result.lines[2]).toMatchObject({
        kind: "invalid",
        evidence: { category: "distribution" },
      });
      expect(
        result.lines.slice(3).every((line) => line.kind === "not_evaluated"),
      ).toBe(true);
    }
  });
  it.each([
    ["2*x+4=10", ["x+2=5", "x=3"]],
    ["x/2+3=5", ["x/2=2", "x=4"]],
    ["-(x-2)=1", ["-x+2=1", "x=1"]],
  ])(
    "accepts equivalent forms with no pedagogy dependency",
    (problem, steps) => {
      expect(analyze({ problem, steps }).kind).toBe("valid_complete");
    },
  );
  it("classifies valid but non-isolated work as in progress", () => {
    expect(analyze({ problem: "2*x=6", steps: ["4*x=12"] }).kind).toBe(
      "valid_in_progress",
    );
  });
  it("classifies a valid isolated solution as complete with no misconception", () => {
    const result = analyze({ problem: "2*x+4=10", steps: ["2*x=6", "x=3"] });
    expect(result.kind).toBe("valid_complete");
    expect(result.lines.some((line) => line.kind === "invalid")).toBe(false);
  });
  it.each([
    ["2*x=1", ["x=1/2"]],
    ["4*x=-2", ["x=-(1/2)"]],
    ["2*x=1", ["(1/2)=x"]],
    ["5*x=3", ["x=(1+2)/(2+3)"]],
  ])(
    "recognizes the exact supported isolated constant form for %s",
    (problem, steps) => {
      const result = analyze({ problem, steps });
      expect(result.kind).toBe("valid_complete");
      expect(result.lines.some((line) => line.kind === "invalid")).toBe(false);
    },
  );
  it("keeps the earliest unrelated error category stable before a later distribution error", () => {
    const result = analyze({
      problem: "2*(x+1)+5=9",
      steps: ["2*(x+1)+5=9", "2*x+2+6=9", "2*x+1=9"],
    });
    expect(result.kind).toBe("needs_repair");
    if (result.kind !== "needs_repair") return;
    expect(result.firstInvalidIndex).toBe(2);
    expect(result.lines[2]).toMatchObject({
      kind: "invalid",
      evidence: { category: "equality_preservation" },
    });
    expect(result.lines[3]).toEqual({ kind: "not_evaluated" });
  });
  it.each([
    ["2*x+1=2*x+2", ["1=2"], "none"],
    ["2*(x+1)=2*x+2", ["0=0"], "all_real"],
  ])("terminates the %s boundary", (problem, steps, kind) => {
    const result = analyze({ problem, steps });
    expect(result).toMatchObject({
      kind: "terminal_boundary",
      solutionSet: { kind },
    });
  });
});
