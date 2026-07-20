import type { AnalysisResult } from "../../contracts/analysis";
import type { PedagogyResult } from "../../contracts/pedagogy";
import type { Attempt, SessionState } from "../../contracts/session";
import type { TransferSession } from "../../app/transfer-use-case";
import { sessionContextSignature } from "../../app/session-reducer";

export type HintEvidence = Readonly<{
  attemptId: number;
  problem: string;
  steps: readonly string[];
  contextRevision: number;
  contextSignature: string;
  firstInvalidIndex: number;
  category: string;
  governingRule: string;
  result: PedagogyResult;
  failureCode?: string;
}>;

export type EvidenceDiagnosis = Readonly<{
  attemptId: number;
  problem: string;
  steps: readonly string[];
  contextRevision: number;
  contextSignature: string;
  firstInvalidIndex: number;
  category: string;
  governingRule: string;
}>;

export type TeacherEvidenceSnapshot = Readonly<{
  status: "empty" | "in_progress" | "complete";
  problem: string;
  steps: readonly string[];
  currentAnalysis: AnalysisResult | null;
  attempts: readonly Attempt[];
  diagnosis: EvidenceDiagnosis | null;
  hint: HintEvidence | null;
  transfer: Readonly<{
    id: string;
    skillTag: string;
    equation: string;
    response: string | null;
    mastery: TransferSession["mastery"];
  }> | null;
}>;

function sameSteps(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((step, index) => step === right[index])
  );
}

function isAcceptedCurrentAttempt(
  attempt: Attempt | undefined,
  state: SessionState,
): attempt is Attempt {
  return Boolean(
    attempt &&
    state.status === "analyzed" &&
    state.analysis &&
    attempt.problem === state.problem &&
    sameSteps(attempt.steps, state.steps) &&
    attempt.contextRevision === state.contextRevision &&
    attempt.contextSignature ===
      sessionContextSignature(state.problem, state.steps) &&
    attempt.analysis === state.analysis,
  );
}

function diagnosisFrom(state: SessionState): EvidenceDiagnosis | null {
  const current = state.attempts.at(-1);
  if (!isAcceptedCurrentAttempt(current, state)) return null;

  let diagnosed: Attempt | undefined;
  if (current.analysis.kind === "needs_repair") diagnosed = current;
  else if (
    current.analysis.kind === "valid_complete" &&
    current.repairOfAttemptId !== undefined
  )
    diagnosed = state.attempts.find(
      (attempt) => attempt.id === current.repairOfAttemptId,
    );
  if (!diagnosed || diagnosed.analysis.kind !== "needs_repair") return null;
  const line = diagnosed.analysis.lines[diagnosed.analysis.firstInvalidIndex];
  if (!line || line.kind !== "invalid") return null;
  return Object.freeze({
    attemptId: diagnosed.id,
    problem: diagnosed.problem,
    steps: Object.freeze([...diagnosed.steps]),
    contextRevision: diagnosed.contextRevision,
    contextSignature: diagnosed.contextSignature,
    firstInvalidIndex: diagnosed.analysis.firstInvalidIndex,
    category: line.evidence.category,
    governingRule: line.evidence.governingRule,
  });
}

export function selectTeacherEvidence(
  state: SessionState,
  hints: readonly HintEvidence[],
  transfer: TransferSession | null,
): TeacherEvidenceSnapshot {
  const attempts = Object.freeze(
    state.attempts.map((attempt) =>
      Object.freeze({ ...attempt, steps: Object.freeze([...attempt.steps]) }),
    ),
  );
  const diagnosis = diagnosisFrom(state);
  const hint = diagnosis
    ? ([...hints]
        .reverse()
        .find(
          (candidate) =>
            candidate.attemptId === diagnosis.attemptId &&
            candidate.problem === diagnosis.problem &&
            sameSteps(candidate.steps, diagnosis.steps) &&
            candidate.contextRevision === diagnosis.contextRevision &&
            candidate.contextSignature === diagnosis.contextSignature &&
            candidate.firstInvalidIndex === diagnosis.firstInvalidIndex &&
            candidate.category === diagnosis.category &&
            candidate.governingRule === diagnosis.governingRule,
        ) ?? null)
    : null;
  const status =
    state.status === "empty"
      ? "empty"
      : transfer?.mastery === "mastered" ||
          transfer?.mastery === "needs_practice"
        ? "complete"
        : "in_progress";
  return Object.freeze({
    status,
    problem: state.problem,
    steps: Object.freeze([...state.steps]),
    currentAnalysis: state.analysis,
    attempts,
    diagnosis,
    hint,
    transfer: transfer
      ? Object.freeze({
          id: transfer.problem.id,
          skillTag: transfer.problem.skillTag,
          equation: transfer.problem.equation,
          response: transfer.response,
          mastery: transfer.mastery,
        })
      : null,
  });
}
