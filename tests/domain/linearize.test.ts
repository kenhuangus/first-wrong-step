import { describe, expect, it } from "vitest";
import { AnalysisBudget } from "../../src/domain/limits";
import { linearize } from "../../src/domain/linearize";
import { parseEquation } from "../../src/domain/parser";
import { toRationalText } from "../../src/domain/rational";
const left = (source: string) =>
  linearize(parseEquation(`${source} = 0`).left, new AnalysisBudget());
describe("affine normalization", () => {
  it("normalizes distribution and rational division exactly", () => {
    const result = left("3*(x+2)/2");
    expect(toRationalText(result.coefficient)).toBe("3/2");
    expect(toRationalText(result.constant)).toBe("3");
  });
  it.each([
    ["x*x", "nonlinear"],
    ["x/(x+1)", "variable_denominator"],
    ["x/(1-1)", "zero_denominator"],
  ])("rejects unsupported %s", (source, code) => {
    try {
      left(source);
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toMatchObject({ code });
    }
  });
});
