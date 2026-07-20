import { describe, expect, it } from "vitest";
import { analyzeSession } from "../../src/app/analyze-use-case";
import {
  initialSessionState,
  sessionReducer,
  sessionContextSignature,
} from "../../src/app/session-reducer";

function requestFor(
  state: Parameters<typeof sessionReducer>[0],
  requestId: string,
) {
  return {
    requestId,
    contextRevision: state.contextRevision,
    contextSignature: sessionContextSignature(state.problem, state.steps),
  } as const;
}

function completeCurrent(
  state: Parameters<typeof sessionReducer>[0],
  requestId: string,
) {
  const request = requestFor(state, requestId);
  const started = sessionReducer(state, {
    type: "analysis_started",
    ...request,
  });
  return sessionReducer(started, {
    type: "analysis_completed",
    result: analyzeSession(state),
    ...request,
  });
}

describe("SLICE-002 repair state", () => {
  it("supports ordered editor operations and immutable prior attempts", () => {
    let state = sessionReducer(initialSessionState, {
      type: "load",
      problem: "3*(x+2)=18",
      steps: ["3*(x+2)=18", "3*x+2=18", "3*x=16", "x=16/3"],
    });
    state = sessionReducer(state, { type: "add_step" });
    state = sessionReducer(state, {
      type: "set_step",
      index: 4,
      value: "note=0",
    });
    state = sessionReducer(state, {
      type: "move_step",
      index: 4,
      direction: -1,
    });
    expect(state.steps[3]).toBe("note=0");
    state = sessionReducer(state, {
      type: "move_step",
      index: 3,
      direction: 1,
    });
    state = sessionReducer(state, { type: "remove_step", index: 4 });
    expect(state.steps).toHaveLength(4);

    state = completeCurrent(state, "first");
    expect(state.attempts).toHaveLength(1);
    const frozenFirstSteps = [...state.attempts[0].steps];

    state = sessionReducer(state, {
      type: "set_step",
      index: 1,
      value: "3*x+6=18",
    });
    const second = analyzeSession(state);
    state = completeCurrent(state, "second");
    expect(state.attempts).toHaveLength(2);
    expect(state.attempts[0].steps).toEqual(frozenFirstSteps);
    expect(state.attempts[0].steps[1]).toBe("3*x+2=18");
    expect(second).toMatchObject({
      kind: "needs_repair",
      firstInvalidIndex: 3,
    });
  });

  it("ignores duplicate completion delivery until an edit starts new work", () => {
    const loaded = sessionReducer(initialSessionState, {
      type: "load",
      problem: "x + 1 = 2",
      steps: ["x + 1 = 2", "x = 1"],
    });
    const result = analyzeSession(loaded);
    const request = requestFor(loaded, "duplicate");
    const started = sessionReducer(loaded, {
      type: "analysis_started",
      ...request,
    });
    const completed = sessionReducer(started, {
      type: "analysis_completed",
      result,
      ...request,
    });
    const duplicate = sessionReducer(completed, {
      type: "analysis_completed",
      result,
      ...request,
    });
    expect(duplicate).toBe(completed);
    expect(duplicate.attempts).toHaveLength(1);
  });

  it.each([
    ["problem edit", { type: "set_problem", value: "x + 1 = 3" } as const],
    ["step edit", { type: "set_step", index: 1, value: "x = 2" } as const],
    ["empty edit", { type: "set_step", index: 1, value: "" } as const],
    ["addition", { type: "add_step" } as const],
    ["removal", { type: "remove_step", index: 1 } as const],
    ["reorder", { type: "move_step", index: 0, direction: 1 } as const],
    [
      "fixture switch",
      {
        type: "load",
        problem: "2*x=6",
        steps: ["2*x=6", "x=3"],
      } as const,
    ],
    ["reset", { type: "reset" } as const],
  ])("ignores a completion invalidated by %s", (_name, mutation) => {
    let state = sessionReducer(initialSessionState, {
      type: "load",
      problem: "x + 1 = 2",
      steps: ["x + 1 = 2", "x = 1"],
    });
    const request = requestFor(state, "stale");
    const result = analyzeSession(state);
    state = sessionReducer(state, { type: "analysis_started", ...request });
    state = sessionReducer(state, mutation);
    const afterMutation = state;
    state = sessionReducer(state, {
      type: "analysis_completed",
      result,
      ...request,
    });
    expect(state).toBe(afterMutation);
    expect(state.analysis).toBeNull();
    expect(state.attempts).toHaveLength(0);
  });

  it("rejects unsolicited, out-of-order, stale-error, and superseded results", () => {
    const loaded = sessionReducer(initialSessionState, {
      type: "load",
      problem: "x + 1 = 2",
      steps: ["x + 1 = 2", "x = 1"],
    });
    const oldRequest = requestFor(loaded, "old");
    const newerRequest = requestFor(loaded, "newer");
    const result = analyzeSession(loaded);

    const unsolicited = sessionReducer(loaded, {
      type: "analysis_completed",
      result,
      ...oldRequest,
    });
    expect(unsolicited).toBe(loaded);

    let state = sessionReducer(loaded, {
      type: "analysis_started",
      ...oldRequest,
    });
    state = sessionReducer(state, {
      type: "analysis_started",
      ...newerRequest,
    });
    const activeNewer = state;
    state = sessionReducer(state, {
      type: "analysis_completed",
      result,
      ...oldRequest,
    });
    expect(state).toBe(activeNewer);
    state = sessionReducer(state, { type: "analysis_failed", ...oldRequest });
    expect(state).toBe(activeNewer);
    state = sessionReducer(state, {
      type: "analysis_completed",
      result,
      ...newerRequest,
    });
    expect(state.attempts).toHaveLength(1);
    expect(state.activeAnalysis).toBeNull();
  });

  it("accepts only the active request's failure and leaves no attempt", () => {
    const loaded = sessionReducer(initialSessionState, {
      type: "load",
      problem: "x + 1 = 2",
      steps: ["x + 1 = 2", "x = 1"],
    });
    const request = requestFor(loaded, "failed");
    const started = sessionReducer(loaded, {
      type: "analysis_started",
      ...request,
    });
    const failed = sessionReducer(started, {
      type: "analysis_failed",
      ...request,
    });
    expect(failed).toMatchObject({
      status: "editing",
      analysis: null,
      activeAnalysis: null,
      attempts: [],
    });
  });
});
