import { describe, expect, it } from "vitest";
import { analyze } from "../../src/domain/analyze";
import {
  initialSessionState,
  sessionContextSignature,
  sessionReducer,
  type WorkbenchAction,
} from "../../src/app/session-reducer";
import { beginTransfer } from "../../src/app/transfer-use-case";
import type { SessionState } from "../../src/contracts/session";
import {
  selectTeacherEvidence,
  type HintEvidence,
} from "../../src/ui/evidence/evidence-selectors";

function record(state: SessionState, requestId: string): SessionState {
  const request = {
    requestId,
    contextRevision: state.contextRevision,
    contextSignature: sessionContextSignature(state.problem, state.steps),
  };
  return sessionReducer(
    sessionReducer(state, { type: "analysis_started", ...request }),
    {
      type: "analysis_completed",
      result: analyze({ problem: state.problem, steps: state.steps }),
      ...request,
    },
  );
}

function diagnosedDistribution(): SessionState {
  return record(
    sessionReducer(initialSessionState, {
      type: "load",
      problem: "3 * (x + 2) = 18",
      steps: ["3 * (x + 2) = 18", "3 * x + 2 = 18", "3 * x = 16", "x = 16 / 3"],
    }),
    "diagnose-a",
  );
}

function matchingHint(state: SessionState): HintEvidence {
  const attempt = state.attempts.at(-1)!;
  if (attempt.analysis.kind !== "needs_repair") throw new Error("fixture");
  const line = attempt.analysis.lines[attempt.analysis.firstInvalidIndex];
  if (line?.kind !== "invalid") throw new Error("fixture line");
  return {
    attemptId: attempt.id,
    problem: attempt.problem,
    steps: attempt.steps,
    contextRevision: attempt.contextRevision,
    contextSignature: attempt.contextSignature,
    firstInvalidIndex: attempt.analysis.firstInvalidIndex,
    category: line.evidence.category,
    governingRule: line.evidence.governingRule,
    result: {
      content: {
        category: "distribution",
        hint: "Inspect each grouped term.",
        explanation: "The outside factor reaches each term.",
      },
      provenance: "reviewed judge fixture",
      status: "ready",
      retryable: false,
    },
  };
}

describe("current evidence lineage", () => {
  it("keeps a repaired same-problem diagnosis and its exact hint lineage", () => {
    let state = diagnosedDistribution();
    const hint = matchingHint(state);
    for (const [index, value] of [
      "3 * x + 6 = 18",
      "3 * x = 12",
      "x = 4",
    ].entries())
      state = sessionReducer(state, {
        type: "set_step",
        index: index + 1,
        value,
      });
    state = record(state, "repaired-a");

    const evidence = selectTeacherEvidence(state, [hint], beginTransfer(state));
    expect(evidence.diagnosis).toMatchObject({
      attemptId: 1,
      problem: "3 * (x + 2) = 18",
      contextRevision: hint.contextRevision,
      contextSignature: hint.contextSignature,
    });
    expect(evidence.diagnosis?.steps).toEqual(hint.steps);
    expect(evidence.hint).toBe(hint);
  });

  it("never attributes A to manually replaced, clean B before or after analysis", () => {
    let state = diagnosedDistribution();
    const hint = matchingHint(state);
    state = sessionReducer(state, {
      type: "set_problem",
      value: "5 * (x - 1) = 20",
    });
    expect(selectTeacherEvidence(state, [hint], null).diagnosis).toBeNull();
    for (const [index, value] of [
      "5 * (x - 1) = 20",
      "5 * x - 5 = 20",
      "x = 5",
    ].entries())
      state = sessionReducer(state, { type: "set_step", index, value });
    state = sessionReducer(state, { type: "remove_step", index: 3 });
    state = record(state, "complete-b");

    const evidence = selectTeacherEvidence(state, [hint], beginTransfer(state));
    expect(evidence.problem).toBe("5 * (x - 1) = 20");
    expect(evidence.diagnosis).toBeNull();
    expect(evidence.hint).toBeNull();
    expect(evidence.attempts).toHaveLength(2);
    expect(evidence.attempts[0]?.problem).toBe("3 * (x + 2) = 18");
  });

  it.each<WorkbenchAction>([
    { type: "set_step", index: 1, value: "3 * x + 6 = 18" },
    { type: "add_step" },
    { type: "remove_step", index: 3 },
    { type: "move_step", index: 1, direction: 1 },
    { type: "set_problem", value: "2 * x = 8" },
  ])("invalidates current diagnosis on direct $type mutation", (action) => {
    const state = diagnosedDistribution();
    const hint = matchingHint(state);
    const edited = sessionReducer(state, action);
    const evidence = selectTeacherEvidence(edited, [hint], null);
    expect(evidence.diagnosis).toBeNull();
    expect(evidence.hint).toBeNull();
  });

  it("invalidates diagnosis on fixture load, reset, and newer clean analysis", () => {
    let state = diagnosedDistribution();
    const hint = matchingHint(state);
    state = sessionReducer(state, {
      type: "load",
      problem: "2 * x = 8",
      steps: ["2 * x = 8", "x = 4"],
    });
    expect(selectTeacherEvidence(state, [hint], null).diagnosis).toBeNull();
    state = record(state, "clean-fixture");
    expect(
      selectTeacherEvidence(state, [hint], beginTransfer(state)).diagnosis,
    ).toBeNull();
    state = sessionReducer(state, { type: "reset" });
    expect(selectTeacherEvidence(state, [hint], null).diagnosis).toBeNull();
  });

  it("rejects a hint whose attempt id matches but lineage does not", () => {
    const state = diagnosedDistribution();
    const hint = matchingHint(state);
    const forged = {
      ...hint,
      problem: "5 * (x - 1) = 20",
      contextSignature: "forged",
    };
    const evidence = selectTeacherEvidence(state, [forged], null);
    expect(evidence.diagnosis?.attemptId).toBe(hint.attemptId);
    expect(evidence.hint).toBeNull();
  });
});
