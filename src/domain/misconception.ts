import type { MisconceptionEvidence } from "../contracts/analysis";
import type { EquationAst, Expression } from "../contracts/domain";
import { equals } from "./rational";

function sameExpression(left: Expression, right: Expression): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "number" && right.kind === "number") {
    return equals(left.value, right.value);
  }
  if (left.kind === "variable" && right.kind === "variable") return true;
  if (left.kind === "unary" && right.kind === "unary") {
    return (
      left.operator === right.operator &&
      sameExpression(left.operand, right.operand)
    );
  }
  if (left.kind === "binary" && right.kind === "binary") {
    return (
      left.operator === right.operator &&
      sameExpression(left.left, right.left) &&
      sameExpression(left.right, right.right)
    );
  }
  return false;
}

function isConstantSyntax(expression: Expression): boolean {
  if (expression.kind === "variable") return false;
  if (expression.kind === "number") return true;
  if (expression.kind === "unary") return isConstantSyntax(expression.operand);
  return (
    isConstantSyntax(expression.left) && isConstantSyntax(expression.right)
  );
}

function productVariants(factor: Expression, term: Expression): Expression[] {
  return [
    { kind: "binary", operator: "*", left: factor, right: term },
    { kind: "binary", operator: "*", left: term, right: factor },
  ];
}

function partialDistributionCandidates(expression: Expression): Expression[] {
  const candidates: Expression[] = [];
  if (expression.kind === "binary") {
    if (expression.operator === "*") {
      const patterns = [
        { factor: expression.left, grouped: expression.right },
        { factor: expression.right, grouped: expression.left },
      ];
      for (const { factor, grouped } of patterns) {
        if (
          isConstantSyntax(factor) &&
          grouped.kind === "binary" &&
          (grouped.operator === "+" || grouped.operator === "-")
        ) {
          for (const scaledLeft of productVariants(factor, grouped.left)) {
            candidates.push({
              kind: "binary",
              operator: grouped.operator,
              left: scaledLeft,
              right: grouped.right,
            });
          }
          for (const scaledRight of productVariants(factor, grouped.right)) {
            candidates.push({
              kind: "binary",
              operator: grouped.operator,
              left: grouped.left,
              right: scaledRight,
            });
          }
        }
      }
    }
    for (const replacement of partialDistributionCandidates(expression.left)) {
      candidates.push({ ...expression, left: replacement });
    }
    for (const replacement of partialDistributionCandidates(expression.right)) {
      candidates.push({ ...expression, right: replacement });
    }
  } else if (expression.kind === "unary") {
    for (const replacement of partialDistributionCandidates(
      expression.operand,
    )) {
      candidates.push({ ...expression, operand: replacement });
    }
  }
  return candidates;
}

function isExactPartialDistribution(
  previous: EquationAst,
  current: EquationAst,
): boolean {
  return (
    partialDistributionCandidates(previous.left).some(
      (candidate) =>
        sameExpression(candidate, current.left) &&
        sameExpression(previous.right, current.right),
    ) ||
    partialDistributionCandidates(previous.right).some(
      (candidate) =>
        sameExpression(candidate, current.right) &&
        sameExpression(previous.left, current.left),
    )
  );
}

export function classifyMisconception(
  previous: EquationAst,
  current: EquationAst,
  previousIndex: number,
  currentIndex: number,
): MisconceptionEvidence {
  if (isExactPartialDistribution(previous, current)) {
    return {
      category: "distribution",
      governingRule:
        "Multiply every term inside the parentheses by the outside factor.",
      previousIndex,
      currentIndex,
    };
  }
  return {
    category: "equality_preservation",
    governingRule: "Each transformation must preserve the same solution set.",
    previousIndex,
    currentIndex,
  };
}
