import type { SessionState } from "../contracts/session";
export const canAnalyze = (state: SessionState): boolean =>
  state.status !== "analyzing" &&
  state.problem.trim().length > 0 &&
  state.steps.length >= 2 &&
  state.steps.every((step) => step.trim().length > 0);
export const selectAnalysis = (state: SessionState) => state.analysis;
export const selectHasValidCompletion = (state: SessionState): boolean =>
  state.analysis?.kind === "valid_complete";
export const selectAttemptCount = (state: SessionState): number =>
  state.attempts.length;
