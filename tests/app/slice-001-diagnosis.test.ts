import { describe, expect, it } from "vitest";
import { analyzeSession } from "../../src/app/analyze-use-case";
import {
  initialSessionState,
  sessionReducer,
  sessionContextSignature,
} from "../../src/app/session-reducer";
describe("SLICE-001 session integration", () => {
  it("loads, preserves edits, analyzes, and records an immutable attempt", () => {
    let state = sessionReducer(initialSessionState, {
      type: "load",
      problem: "3*(x+2)=18",
      steps: ["3*(x+2)=18", "3*x+2=18", "x=5"],
    });
    state = sessionReducer(state, {
      type: "set_step",
      index: 2,
      value: "x=16/3",
    });
    const edited = state.steps;
    const request = {
      requestId: "slice-001-request",
      contextRevision: state.contextRevision,
      contextSignature: sessionContextSignature(state.problem, state.steps),
    };
    state = sessionReducer(state, { type: "analysis_started", ...request });
    state = sessionReducer(state, {
      type: "analysis_completed",
      result: analyzeSession(state),
      ...request,
    });
    expect(state.analysis).toMatchObject({
      kind: "needs_repair",
      firstInvalidIndex: 2,
    });
    expect(state.steps).toEqual(edited);
    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0]?.steps).toEqual(edited);
  });
  it("does not expose or invoke a pedagogy adapter", () => {
    const result = analyzeSession({ problem: "2*x=6", steps: ["x=3"] });
    expect(result.kind).toBe("valid_complete");
    expect(JSON.stringify(result)).not.toContain("hint");
    expect(JSON.stringify(result)).not.toContain("provenance");
  });
});
