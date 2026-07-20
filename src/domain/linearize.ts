import type { Affine, Expression } from "../contracts/domain";
import { InputError } from "./errors";
import type { AnalysisBudget } from "./limits";
import {
  ONE,
  ZERO,
  add,
  divide,
  isZero,
  multiply,
  negate,
  subtract,
} from "./rational";
export function linearize(
  expression: Expression,
  budget: AnalysisBudget,
): Affine {
  budget.charge();
  if (expression.kind === "number")
    return { coefficient: ZERO, constant: expression.value };
  if (expression.kind === "variable")
    return { coefficient: ONE, constant: ZERO };
  if (expression.kind === "unary") {
    const operand = linearize(expression.operand, budget);
    return expression.operator === "+"
      ? operand
      : {
          coefficient: negate(operand.coefficient, budget),
          constant: negate(operand.constant, budget),
        };
  }
  const left = linearize(expression.left, budget);
  const right = linearize(expression.right, budget);
  if (expression.operator === "+" || expression.operator === "-") {
    const combine = expression.operator === "+" ? add : subtract;
    return {
      coefficient: combine(left.coefficient, right.coefficient, budget),
      constant: combine(left.constant, right.constant, budget),
    };
  }
  if (expression.operator === "*") {
    if (!isZero(left.coefficient) && !isZero(right.coefficient))
      throw new InputError(
        "nonlinear",
        "Products containing x on both sides are nonlinear and unsupported.",
      );
    if (isZero(left.coefficient))
      return {
        coefficient: multiply(left.constant, right.coefficient, budget),
        constant: multiply(left.constant, right.constant, budget),
      };
    return {
      coefficient: multiply(left.coefficient, right.constant, budget),
      constant: multiply(left.constant, right.constant, budget),
    };
  }
  if (!isZero(right.coefficient))
    throw new InputError(
      "variable_denominator",
      "Divide only by a constant that does not contain x.",
    );
  if (isZero(right.constant))
    throw new InputError(
      "zero_denominator",
      "A denominator cannot equal zero.",
    );
  return {
    coefficient: divide(left.coefficient, right.constant, budget),
    constant: divide(left.constant, right.constant, budget),
  };
}
