import type {
  Attempt,
  PendingRepair,
  SessionAction,
  SessionState,
} from "../contracts/session";
import { analyze } from "../domain/analyze";
export type EditorAction =
  | Readonly<{ type: "add_step" }>
  | Readonly<{ type: "remove_step"; index: number }>
  | Readonly<{ type: "move_step"; index: number; direction: -1 | 1 }>;
export type WorkbenchAction = SessionAction | EditorAction;
export const initialSessionState: SessionState = Object.freeze({
  status: "empty",
  problem: "",
  steps: Object.freeze([]),
  analysis: null,
  attempts: Object.freeze([]),
  nextAttemptId: 1,
  contextRevision: 0,
  activeAnalysis: null,
  pendingRepair: null,
});

export function sessionContextSignature(
  problem: string,
  steps: readonly string[],
): string {
  return JSON.stringify([problem, steps]);
}

function invalidateContext(
  state: SessionState,
  update: Pick<SessionState, "problem" | "steps">,
): SessionState {
  const contextRevision = state.contextRevision + 1;
  const pendingRepair = repairAfterEdit(
    state,
    update.problem,
    update.steps,
    contextRevision,
  );
  return {
    ...state,
    ...update,
    status: "editing",
    analysis: null,
    activeAnalysis: null,
    contextRevision,
    pendingRepair,
  };
}

function sameSteps(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((step, index) => step === right[index])
  );
}

function deterministicDiagnosis(attempt: Attempt): boolean {
  const proof = analyze({ problem: attempt.problem, steps: attempt.steps });
  return (
    proof.kind === "needs_repair" &&
    attempt.analysis.kind === "needs_repair" &&
    proof.firstInvalidIndex === attempt.analysis.firstInvalidIndex &&
    JSON.stringify(proof) === JSON.stringify(attempt.analysis)
  );
}

/**
 * Returns the one live repair source. Its source must still be the immediately
 * preceding accepted attempt; history can never recreate this token.
 */
function repairSource(state: SessionState): Attempt | null {
  const edge = state.pendingRepair;
  const source = state.attempts.at(-1);
  if (
    !edge ||
    !source ||
    source.id !== edge.diagnosisAttemptId ||
    source.problem !== edge.problem ||
    source.analysis.kind !== "needs_repair" ||
    source.analysis.firstInvalidIndex - 1 !== edge.repairStepIndex ||
    !sameSteps(
      source.steps.slice(0, edge.repairStepIndex),
      edge.preservedPrefix,
    ) ||
    state.problem !== edge.problem ||
    !sameSteps(
      state.steps.slice(0, edge.repairStepIndex),
      edge.preservedPrefix,
    ) ||
    state.contextRevision !== edge.contextRevision ||
    sessionContextSignature(state.problem, state.steps) !==
      edge.contextSignature ||
    !deterministicDiagnosis(source)
  )
    return null;
  return source;
}

function repairAfterEdit(
  state: SessionState,
  problem: string,
  steps: readonly string[],
  contextRevision: number,
): PendingRepair | null {
  const source = repairSource(state);
  const edge = state.pendingRepair;
  if (
    !source ||
    !edge ||
    problem !== edge.problem ||
    steps.length <= edge.repairStepIndex ||
    !sameSteps(steps.slice(0, edge.repairStepIndex), edge.preservedPrefix)
  )
    return null;
  return Object.freeze({
    ...edge,
    contextRevision,
    contextSignature: sessionContextSignature(problem, steps),
  });
}

function pendingRepairForAttempt(attempt: Attempt): PendingRepair | null {
  if (attempt.analysis.kind !== "needs_repair") return null;
  const repairStepIndex = attempt.analysis.firstInvalidIndex - 1;
  if (repairStepIndex < 0 || repairStepIndex >= attempt.steps.length)
    return null;
  return Object.freeze({
    diagnosisAttemptId: attempt.id,
    problem: attempt.problem,
    repairStepIndex,
    preservedPrefix: Object.freeze(attempt.steps.slice(0, repairStepIndex)),
    contextRevision: attempt.contextRevision,
    contextSignature: attempt.contextSignature,
  });
}

function matchesActiveRequest(
  state: SessionState,
  action: Readonly<{
    requestId: string;
    contextRevision: number;
    contextSignature: string;
  }>,
): boolean {
  const active = state.activeAnalysis;
  return Boolean(
    active &&
    active.requestId === action.requestId &&
    active.contextRevision === action.contextRevision &&
    active.contextSignature === action.contextSignature &&
    state.contextRevision === action.contextRevision &&
    sessionContextSignature(state.problem, state.steps) ===
      action.contextSignature,
  );
}
export function sessionReducer(
  state: SessionState,
  action: WorkbenchAction,
): SessionState {
  switch (action.type) {
    case "load":
      return {
        ...initialSessionState,
        status: "editing",
        problem: action.problem,
        steps: [...action.steps],
        contextRevision: state.contextRevision + 1,
      };
    case "set_problem":
      return invalidateContext(state, {
        problem: action.value,
        steps: state.steps,
      });
    case "set_step": {
      if (action.index < 0 || action.index >= state.steps.length) return state;
      const steps = [...state.steps];
      steps[action.index] = action.value;
      return invalidateContext(state, { problem: state.problem, steps });
    }
    case "add_step":
      return invalidateContext(state, {
        problem: state.problem,
        steps: [...state.steps, ""],
      });
    case "remove_step":
      if (action.index < 0 || action.index >= state.steps.length) return state;
      return invalidateContext(state, {
        problem: state.problem,
        steps: state.steps.filter((_, index) => index !== action.index),
      });
    case "move_step": {
      const target = action.index + action.direction;
      if (target < 0 || target >= state.steps.length) return state;
      const steps = [...state.steps];
      const currentStep = steps[action.index];
      steps[action.index] = steps[target];
      steps[target] = currentStep;
      return invalidateContext(state, { problem: state.problem, steps });
    }
    case "analysis_started": {
      if (
        action.contextRevision !== state.contextRevision ||
        action.contextSignature !==
          sessionContextSignature(state.problem, state.steps)
      )
        return state;
      return {
        ...state,
        status: "analyzing",
        analysis: null,
        activeAnalysis: {
          requestId: action.requestId,
          contextRevision: action.contextRevision,
          contextSignature: action.contextSignature,
        },
        pendingRepair: repairSource(state) ? state.pendingRepair : null,
      };
    }
    case "analysis_completed": {
      if (!matchesActiveRequest(state, action)) return state;
      const repairOfAttemptId =
        action.result.kind === "valid_complete"
          ? repairSource(state)?.id
          : undefined;
      const attempt: Attempt = Object.freeze({
        id: state.nextAttemptId,
        problem: state.problem,
        steps: Object.freeze([...state.steps]),
        contextRevision: state.contextRevision,
        contextSignature: sessionContextSignature(state.problem, state.steps),
        analysis: action.result,
        ...(repairOfAttemptId === undefined ? {} : { repairOfAttemptId }),
      });
      return {
        ...state,
        status: "analyzed",
        analysis: action.result,
        activeAnalysis: null,
        attempts: [...state.attempts, attempt],
        nextAttemptId: state.nextAttemptId + 1,
        pendingRepair: pendingRepairForAttempt(attempt),
      };
    }
    case "analysis_failed":
      if (!matchesActiveRequest(state, action)) return state;
      return {
        ...state,
        status: "editing",
        analysis: null,
        activeAnalysis: null,
        pendingRepair: null,
      };
    case "reset":
      return {
        ...initialSessionState,
        contextRevision: state.contextRevision + 1,
      };
  }
}
