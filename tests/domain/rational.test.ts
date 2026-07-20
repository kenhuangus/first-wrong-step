import { describe, expect, it } from "vitest";
import {
  add,
  divide,
  equals,
  multiply,
  rational,
  subtract,
  toRationalText,
} from "../../src/domain/rational";
describe("exact rationals", () => {
  it("reduces signs and fractions canonically", () => {
    expect(rational(2n, -4n)).toEqual({ numerator: -1n, denominator: 2n });
    expect(toRationalText(rational(6n, 3n))).toBe("2");
  });
  it("performs exact arithmetic without floating point", () => {
    expect(toRationalText(add(rational(1n, 3n), rational(1n, 6n)))).toBe("1/2");
    expect(toRationalText(subtract(rational(1n), rational(3n, 2n)))).toBe(
      "-1/2",
    );
    expect(toRationalText(multiply(rational(2n, 3n), rational(9n, 4n)))).toBe(
      "3/2",
    );
    expect(toRationalText(divide(rational(2n), rational(3n)))).toBe("2/3");
    expect(equals(rational(2n, 4n), rational(1n, 2n))).toBe(true);
  });
  it("rejects zero denominators", () => {
    expect(() => rational(1n, 0n)).toThrow(/zero/u);
    expect(() => divide(rational(1n), rational(0n))).toThrow(/zero/u);
  });
});
