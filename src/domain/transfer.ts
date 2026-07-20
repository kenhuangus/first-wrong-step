import type { AnalysisResult } from "../contracts/analysis";
import type { Expression } from "../contracts/domain";
import { analyze } from "./analyze";
import { parseEquation } from "./parser";

export type TransferSkill =
  "distribution" | "equality_preservation" | "inverse_operation";

export type TransferProblem = Readonly<{
  id: string;
  skillTag: TransferSkill;
  equation: string;
  expectedSolution: string;
}>;

export type TransferContext = Readonly<{
  contextKey: string;
  skillTag: TransferSkill;
  originalProblem: string;
  originalSolution: string;
}>;

const CANDIDATES: Readonly<Record<TransferSkill, readonly TransferProblem[]>> =
  {
    distribution: Object.freeze([
      {
        id: "distribution-transfer-a",
        skillTag: "distribution",
        equation: "3 * (x + 1) = 18",
        expectedSolution: "5",
      },
      {
        id: "distribution-transfer-b",
        skillTag: "distribution",
        equation: "2 * (x + 4) = 14",
        expectedSolution: "3",
      },
      {
        id: "distribution-transfer-c",
        skillTag: "distribution",
        equation: "4 * (x - 2) = 20",
        expectedSolution: "7",
      },
    ]),
    equality_preservation: Object.freeze([
      {
        id: "equality-transfer-a",
        skillTag: "equality_preservation",
        equation: "5 * x + 2 = 17",
        expectedSolution: "3",
      },
      {
        id: "equality-transfer-b",
        skillTag: "equality_preservation",
        equation: "3 * x - 4 = 11",
        expectedSolution: "5",
      },
      {
        id: "equality-transfer-c",
        skillTag: "equality_preservation",
        equation: "7 * x + 1 = 43",
        expectedSolution: "6",
      },
    ]),
    inverse_operation: Object.freeze([
      {
        id: "inverse-transfer-a",
        skillTag: "inverse_operation",
        equation: "6 * x - 3 = 15",
        expectedSolution: "3",
      },
      {
        id: "inverse-transfer-b",
        skillTag: "inverse_operation",
        equation: "5 * x + 5 = 35",
        expectedSolution: "6",
      },
      {
        id: "inverse-transfer-c",
        skillTag: "inverse_operation",
        equation: "8 * x + 4 = 20",
        expectedSolution: "2",
      },
    ]),
  };

function stableIndex(value: string, size: number): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) % size;
}

function containsVariable(expression: Expression): boolean {
  if (expression.kind === "variable") return true;
  if (expression.kind === "number") return false;
  if (expression.kind === "unary") return containsVariable(expression.operand);
  return (
    containsVariable(expression.left) || containsVariable(expression.right)
  );
}

function isConstantSyntax(expression: Expression): boolean {
  return !containsVariable(expression);
}

function containsDistributionStructure(expression: Expression): boolean {
  if (expression.kind === "unary")
    return containsDistributionStructure(expression.operand);
  if (expression.kind !== "binary") return false;
  if (expression.operator === "*") {
    const pairs = [
      [expression.left, expression.right],
      [expression.right, expression.left],
    ] as const;
    if (
      pairs.some(
        ([factor, grouped]) =>
          isConstantSyntax(factor) &&
          grouped.kind === "binary" &&
          (grouped.operator === "+" || grouped.operator === "-") &&
          containsVariable(grouped),
      )
    )
      return true;
  }
  return (
    containsDistributionStructure(expression.left) ||
    containsDistributionStructure(expression.right)
  );
}

/** Stable BR-007 skill classification for a clean supported equation. */
export function deriveEquationSkill(problem: string): TransferSkill | null {
  const proof = analyze({ problem, steps: [problem] });
  if (proof.kind === "input_error" || proof.solutionSet.kind !== "unique")
    return null;
  const equation = parseEquation(problem);
  return containsDistributionStructure(equation.left) ||
    containsDistributionStructure(equation.right)
    ? "distribution"
    : "inverse_operation";
}

function completionFor(candidate: TransferProblem): AnalysisResult {
  return analyze({
    problem: candidate.equation,
    steps: [candidate.equation, `x = ${candidate.expectedSolution}`],
  });
}

function isSafeCandidate(
  candidate: TransferProblem,
  context: TransferContext,
): boolean {
  if (
    candidate.skillTag !== context.skillTag ||
    candidate.equation.replaceAll(" ", "") ===
      context.originalProblem.replaceAll(" ", "") ||
    candidate.expectedSolution === context.originalSolution
  )
    return false;
  const completion = completionFor(candidate);
  return (
    completion.kind === "valid_complete" &&
    completion.solutionSet.value === candidate.expectedSolution
  );
}

/**
 * Selects a bounded, repository-reviewed transfer item from accepted context.
 * Algebra validation remains deterministic and never depends on pedagogy text.
 */
export function generateTransfer(context: TransferContext): TransferProblem {
  const candidates = CANDIDATES[context.skillTag];
  const first = stableIndex(
    `${context.contextKey}|${context.originalProblem}|${context.originalSolution}`,
    candidates.length,
  );
  for (let offset = 0; offset < candidates.length; offset += 1) {
    const candidate = candidates[(first + offset) % candidates.length];
    if (candidate && isSafeCandidate(candidate, context))
      return Object.freeze({ ...candidate });
  }
  throw new Error("No validated transfer item matches the accepted context.");
}

export function scoreTransfer(
  problem: TransferProblem,
  response: string,
): "mastered" | "needs_practice" {
  const trimmed = response.trim();
  if (trimmed.length === 0 || trimmed.length > 48) return "needs_practice";
  const result = analyze({
    problem: problem.equation,
    steps: [problem.equation, `x = ${trimmed}`],
  });
  return result.kind === "valid_complete" &&
    result.solutionSet.value === problem.expectedSolution
    ? "mastered"
    : "needs_practice";
}
