import type { AnalysisResult } from "../contracts/analysis";
import type { Attempt, SessionState } from "../contracts/session";
import { analyze } from "../domain/analyze";
import {
  deriveEquationSkill,
  generateTransfer,
  scoreTransfer,
  type TransferProblem,
  type TransferSkill,
} from "../domain/transfer";
import { sessionContextSignature } from "./session-reducer";

export type Mastery = "in_progress" | "mastered" | "needs_practice";

export type TransferSession = Readonly<{
  problem: TransferProblem;
  response: string | null;
  mastery: Mastery;
}>;

function sameSteps(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((step, index) => step === right[index])
  );
}

function acceptedCompletion(state: SessionState): AnalysisResult | null {
  const latest = state.attempts.at(-1);
  if (
    state.status !== "analyzed" ||
    state.analysis?.kind !== "valid_complete" ||
    !latest ||
    latest.problem !== state.problem ||
    !sameSteps(latest.steps, state.steps) ||
    latest.analysis.kind !== "valid_complete"
  )
    return null;

  // Transfer authority is the deterministic core, not caller-supplied state.
  const proof = analyze({ problem: state.problem, steps: state.steps });
  if (
    proof.kind !== "valid_complete" ||
    proof.solutionSet.value !== state.analysis.solutionSet.value ||
    proof.solutionSet.value !== latest.analysis.solutionSet.value
  )
    return null;
  return proof;
}

function diagnosedSkill(attempt: Attempt): TransferSkill | null {
  if (attempt.analysis.kind !== "needs_repair") return null;
  const line = attempt.analysis.lines[attempt.analysis.firstInvalidIndex];
  if (line?.kind !== "invalid") return null;
  const skill = line.evidence.category;
  if (skill !== "distribution" && skill !== "equality_preservation")
    return null;

  return skill;
}

/**
 * Derives transfer solely from the latest accepted deterministic attempt and
 * the current completion's explicit, reducer-issued repair parent.
 */
export function beginTransfer(state: SessionState): TransferSession | null {
  const completion = acceptedCompletion(state);
  if (completion?.kind !== "valid_complete") return null;

  const current = state.attempts.at(-1);
  const repairParent = current?.repairOfAttemptId
    ? state.attempts.find((attempt) => attempt.id === current.repairOfAttemptId)
    : undefined;
  let skillTag = repairParent ? diagnosedSkill(repairParent) : null;
  skillTag ??= deriveEquationSkill(state.problem);
  if (!skillTag) return null;

  return Object.freeze({
    problem: generateTransfer({
      contextKey: sessionContextSignature(state.problem, state.steps),
      skillTag,
      originalProblem: state.problem,
      originalSolution: completion.solutionSet.value,
    }),
    response: null,
    mastery: "in_progress",
  });
}

export function submitTransfer(
  session: TransferSession,
  response: string,
): TransferSession {
  const preservedResponse = response.trim();
  return Object.freeze({
    ...session,
    response: preservedResponse,
    mastery: scoreTransfer(session.problem, preservedResponse),
  });
}
