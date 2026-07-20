import type { EquationAst, SolutionSet } from "../contracts/domain";
import type { AnalysisBudget } from "./limits";
import { linearize } from "./linearize";
import { divide, isZero, negate, subtract, toRationalText } from "./rational";
export function classifySolutionSet(
  equation: EquationAst,
  budget: AnalysisBudget,
): SolutionSet {
  const left = linearize(equation.left, budget);
  const right = linearize(equation.right, budget);
  const coefficient = subtract(left.coefficient, right.coefficient, budget);
  const constant = subtract(left.constant, right.constant, budget);
  budget.charge();
  if (isZero(coefficient))
    return isZero(constant) ? { kind: "all_real" } : { kind: "none" };
  return {
    kind: "unique",
    value: toRationalText(
      divide(negate(constant, budget), coefficient, budget),
    ),
  };
}
export function solutionSetsEqual(
  left: SolutionSet,
  right: SolutionSet,
): boolean {
  return (
    left.kind === right.kind &&
    (left.kind !== "unique" ||
      (right.kind === "unique" && left.value === right.value))
  );
}
