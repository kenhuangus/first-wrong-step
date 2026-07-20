import { describe, expect, it } from "vitest";
import { AnalysisBudget } from "../../src/domain/limits";
import { parseEquation } from "../../src/domain/parser";
import {
  classifySolutionSet,
  solutionSetsEqual,
} from "../../src/domain/solution-set";
const classify = (source: string) =>
  classifySolutionSet(parseEquation(source), new AnalysisBudget());
describe("solution sets", () => {
  it.each([
    ["2*x+4=10", { kind: "unique", value: "3" }],
    ["2*x+4=2*x+5", { kind: "none" }],
    ["2*(x+1)=2*x+2", { kind: "all_real" }],
  ])("classifies %s", (source, expected) => {
    expect(classify(source)).toEqual(expected);
  });
  it("compares semantic sets rather than text", () => {
    expect(solutionSetsEqual(classify("2*x+4=10"), classify("x=3"))).toBe(true);
    expect(solutionSetsEqual(classify("x=3"), classify("x=4"))).toBe(false);
  });
});
