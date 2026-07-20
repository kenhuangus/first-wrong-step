import type {
  AnalysisResult,
  AnalyzeInput,
  LineDisposition,
} from "../contracts/analysis";
import type { EquationAst, Rational, SolutionSet } from "../contracts/domain";
import { ComplexityError, InputError } from "./errors";
import { AnalysisBudget, preflightInput, type Clock } from "./limits";
import { classifyMisconception } from "./misconception";
import { parseEquation } from "./parser";
import {
  add,
  divide,
  multiply,
  negate,
  subtract,
  toRationalText,
} from "./rational";
import { classifySolutionSet, solutionSetsEqual } from "./solution-set";
export type AnalyzeOptions = Readonly<{
  clock?: Clock;
  budget?: AnalysisBudget;
}>;
const pendingLines = (count: number): LineDisposition[] =>
  Array.from({ length: count }, () => ({ kind: "not_evaluated" as const }));
function constantText(expression: EquationAst["left"]): string | null {
  if (expression.kind === "variable") return null;
  if (expression.kind === "number") return toRationalText(expression.value);
  if (expression.kind === "unary") {
    const operand = constantValue(expression.operand);
    return operand === null
      ? null
      : toRationalText(expression.operator === "+" ? operand : negate(operand));
  }
  const value = constantValue(expression);
  return value === null ? null : toRationalText(value);
}

function constantValue(expression: EquationAst["left"]): Rational | null {
  if (expression.kind === "variable") return null;
  if (expression.kind === "number") return expression.value;
  if (expression.kind === "unary") {
    const operand = constantValue(expression.operand);
    return operand === null
      ? null
      : expression.operator === "+"
        ? operand
        : negate(operand);
  }
  const left = constantValue(expression.left);
  const right = constantValue(expression.right);
  if (left === null || right === null) return null;
  switch (expression.operator) {
    case "+":
      return add(left, right);
    case "-":
      return subtract(left, right);
    case "*":
      return multiply(left, right);
    case "/":
      return divide(left, right);
  }
}
function isIsolated(ast: EquationAst, expected: string): boolean {
  return (
    (ast.left.kind === "variable" && constantText(ast.right) === expected) ||
    (ast.right.kind === "variable" && constantText(ast.left) === expected)
  );
}
export function analyze(
  input: AnalyzeInput,
  options: AnalyzeOptions = {},
): AnalysisResult {
  const lines = [input.problem, ...input.steps];
  const dispositions = pendingLines(lines.length);
  let activeLine: number | undefined;
  try {
    preflightInput(input.problem, input.steps);
    const budget = options.budget ?? new AnalysisBudget(options.clock);
    const parsed: EquationAst[] = [];
    const solutions: SolutionSet[] = [];
    activeLine = 0;
    const problemAst = parseEquation(lines[0] ?? "", budget);
    parsed.push(problemAst);
    const original = classifySolutionSet(problemAst, budget);
    solutions.push(original);
    dispositions[0] = { kind: "valid", solutionSet: original };
    for (let index = 1; index < lines.length; index += 1) {
      activeLine = index;
      const ast = parseEquation(lines[index] ?? "", budget);
      const current = classifySolutionSet(ast, budget);
      parsed.push(ast);
      solutions.push(current);
      const previous = solutions[index - 1];
      if (!solutionSetsEqual(previous, current)) {
        dispositions[index] = {
          kind: "invalid",
          previousIndex: index - 1,
          currentIndex: index,
          evidence: classifyMisconception(
            parsed[index - 1],
            ast,
            index - 1,
            index,
          ),
        };
        return {
          kind: "needs_repair",
          lines: dispositions,
          firstInvalidIndex: index,
          solutionSet: original,
        };
      }
      dispositions[index] = { kind: "valid", solutionSet: current };
    }
    if (original.kind === "none" || original.kind === "all_real")
      return {
        kind: "terminal_boundary",
        lines: dispositions,
        solutionSet: original,
      };
    if (isIsolated(parsed.at(-1)!, original.value))
      return {
        kind: "valid_complete",
        lines: dispositions,
        solutionSet: original,
      };
    return {
      kind: "valid_in_progress",
      lines: dispositions,
      solutionSet: original,
    };
  } catch (error) {
    if (error instanceof ComplexityError) {
      const lineIndex =
        error.limit === "step_count" || error.limit === "total_characters"
          ? undefined
          : activeLine;
      const disposition: LineDisposition = {
        kind: "too_complex",
        ...(lineIndex === undefined ? {} : { lineIndex }),
        limit: error.limit,
        message: "Input too complex—shorten this equation or solution",
      };
      dispositions[lineIndex ?? 0] = disposition;
      return { kind: "input_error", lines: dispositions };
    }
    if (error instanceof InputError) {
      const lineIndex = activeLine ?? 0;
      dispositions[lineIndex] = {
        kind: "unsupported",
        lineIndex,
        code: error.code,
        message: error.message,
      };
      return { kind: "input_error", lines: dispositions };
    }
    throw error;
  }
}

/** Public deterministic reasoning boundary. */
export const analyzeReasoning = analyze;
