import type { SessionState } from "../contracts/session";
import { analyze, type AnalyzeOptions } from "../domain/analyze";
export function analyzeSession(
  state: Pick<SessionState, "problem" | "steps">,
  options?: AnalyzeOptions,
) {
  return analyze({ problem: state.problem, steps: state.steps }, options);
}
