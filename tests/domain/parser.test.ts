import { describe, expect, it } from "vitest";
import { parseEquation } from "../../src/domain/parser";
describe("equation parser", () => {
  it.each(["x/2+3=4", "x/(2+3)=4", "x/-2*3=4", "x/(1/2)=4", "--x=2"])(
    "accepts the frozen grammar: %s",
    (source) => {
      expect(parseEquation(source)).toBeDefined();
    },
  );
  it.each(["x 2 = 4", "x =", "= x", "x = 1 = 2", "(x + 1 = 2"])(
    "rejects malformed input: %s",
    (source) => {
      expect(() => parseEquation(source)).toThrow();
    },
  );
  it.each([
    "x/(x-x+2)=1",
    "x/(2+x-x)=1",
    "x/(1+(x-x))=1",
    "x/((x-x)+2)=1",
    "x/x=1",
  ])(
    "rejects a syntactically variable denominator before cancellation: %s",
    (source) => {
      expect(() => parseEquation(source)).toThrow(
        expect.objectContaining({ code: "variable_denominator" }),
      );
    },
  );
});
