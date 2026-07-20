import { describe, expect, it } from "vitest";
import { classifyMisconception } from "../../src/domain/misconception";
import { parseEquation } from "../../src/domain/parser";

describe("bounded misconception evidence", () => {
  it("recognizes an exact partial distribution transition", () => {
    expect(
      classifyMisconception(
        parseEquation("3*(x+2)=18"),
        parseEquation("3*x+2=18"),
        1,
        2,
      ),
    ).toMatchObject({
      category: "distribution",
      previousIndex: 1,
      currentIndex: 2,
    });
  });

  it("uses a safe deterministic fallback category", () => {
    expect(
      classifyMisconception(parseEquation("x=3"), parseEquation("x=4"), 1, 2)
        .category,
    ).toBe("equality_preservation");
  });

  it.each([
    ["2*(x+1)+5=9", "2*x+2+6=9"],
    ["(x+1)+2=5", "x+1=5"],
    ["3*(x+2)+1=19", "3*x+6+2=19"],
  ])(
    "does not blame distribution for an unrelated delta: %s -> %s",
    (previous, current) => {
      expect(
        classifyMisconception(
          parseEquation(previous),
          parseEquation(current),
          1,
          2,
        ).category,
      ).toBe("equality_preservation");
    },
  );

  it("recognizes an exact partial distribution on the right side", () => {
    expect(
      classifyMisconception(
        parseEquation("18=3*(x+2)"),
        parseEquation("18=3*x+2"),
        1,
        2,
      ).category,
    ).toBe("distribution");
  });
});
