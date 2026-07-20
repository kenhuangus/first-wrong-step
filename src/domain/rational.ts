import type { Rational } from "../contracts/domain";
import type { AnalysisBudget } from "./limits";
function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a === 0n ? 1n : a;
}
export function rational(numerator: bigint, denominator = 1n): Rational {
  if (denominator === 0n)
    throw new RangeError("Rational denominator cannot be zero.");
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcd(numerator, denominator);
  return Object.freeze({
    numerator: (numerator / divisor) * sign,
    denominator: (denominator / divisor) * sign,
  });
}
export const ZERO = rational(0n);
export const ONE = rational(1n);
export function add(
  left: Rational,
  right: Rational,
  budget?: AnalysisBudget,
): Rational {
  budget?.charge();
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}
export function subtract(
  left: Rational,
  right: Rational,
  budget?: AnalysisBudget,
): Rational {
  budget?.charge();
  return rational(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}
export function multiply(
  left: Rational,
  right: Rational,
  budget?: AnalysisBudget,
): Rational {
  budget?.charge();
  return rational(
    left.numerator * right.numerator,
    left.denominator * right.denominator,
  );
}
export function divide(
  left: Rational,
  right: Rational,
  budget?: AnalysisBudget,
): Rational {
  budget?.charge();
  if (right.numerator === 0n) throw new RangeError("Division by zero.");
  return rational(
    left.numerator * right.denominator,
    left.denominator * right.numerator,
  );
}
export function negate(value: Rational, budget?: AnalysisBudget): Rational {
  budget?.charge();
  return rational(-value.numerator, value.denominator);
}
export function equals(left: Rational, right: Rational): boolean {
  return (
    left.numerator === right.numerator && left.denominator === right.denominator
  );
}
export function isZero(value: Rational): boolean {
  return value.numerator === 0n;
}
export function toRationalText(value: Rational): string {
  return value.denominator === 1n
    ? value.numerator.toString()
    : `${value.numerator.toString()}/${value.denominator.toString()}`;
}
