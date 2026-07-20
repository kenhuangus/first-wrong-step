import { describe, expect, it } from "vitest";
import { analyzeSession } from "../../src/app/analyze-use-case";
import { beginTransfer, submitTransfer } from "../../src/app/transfer-use-case";
import {
  initialSessionState,
  sessionContextSignature,
  sessionReducer,
} from "../../src/app/session-reducer";
import { getFixture } from "../../src/content/pedagogy-assets";
import type { PedagogyResult } from "../../src/contracts/pedagogy";
import { selectTeacherEvidence } from "../../src/ui/evidence/evidence-selectors";

function complete(
  state: Parameters<typeof sessionReducer>[0],
  requestId: string,
) {
  const request = {
    requestId,
    contextRevision: state.contextRevision,
    contextSignature: sessionContextSignature(state.problem, state.steps),
  };
  const result = analyzeSession(state);
  return {
    result,
    state: sessionReducer(
      sessionReducer(state, { type: "analysis_started", ...request }),
      { type: "analysis_completed", result, ...request },
    ),
  };
}

describe("SLICE-003 mastery and evidence selectors", () => {
  it("offers transfer only after completion and preserves exact mastery evidence", () => {
    const fixture = getFixture("fully-valid-isolation")!;
    let state = sessionReducer(initialSessionState, {
      type: "load",
      problem: fixture.problem,
      steps: fixture.steps,
    });
    expect(beginTransfer(state)).toBeNull();
    const completed = complete(state, "valid");
    state = completed.state;
    const transfer = beginTransfer(state)!;
    expect(transfer.mastery).toBe("in_progress");
    const mastered = submitTransfer(
      transfer,
      transfer.problem.expectedSolution,
    );
    const snapshot = selectTeacherEvidence(state, [], mastered);
    expect(snapshot.transfer).toMatchObject({
      equation: transfer.problem.equation,
      response: transfer.problem.expectedSolution,
      mastery: "mastered",
    });
    expect(snapshot.transfer).not.toHaveProperty("expectedSolution");
  });

  it("retains the repaired diagnosis, reviewed provenance, and immutable ordered attempts", () => {
    const fixture = getFixture("distribution-first-wrong-step")!;
    let state = sessionReducer(initialSessionState, {
      type: "load",
      problem: fixture.problem,
      steps: fixture.steps,
    });
    const diagnosed = complete(state, "diagnosed");
    state = diagnosed.state;
    const hint: PedagogyResult = {
      content: {
        category: "distribution",
        hint: "Inspect each term.",
        explanation: "The factor reaches each grouped term.",
      },
      provenance: "reviewed judge fixture",
      status: "ready",
      retryable: false,
    };
    state = sessionReducer(state, {
      type: "set_step",
      index: 1,
      value: "3 * x + 6 = 18",
    });
    state = sessionReducer(state, {
      type: "set_step",
      index: 2,
      value: "3 * x = 12",
    });
    state = sessionReducer(state, {
      type: "set_step",
      index: 3,
      value: "x = 4",
    });
    const repaired = complete(state, "repaired");
    state = repaired.state;
    const transfer = beginTransfer(state)!;
    const completedTransfer = submitTransfer(
      transfer,
      transfer.problem.expectedSolution,
    );
    const snapshot = selectTeacherEvidence(
      state,
      [
        {
          attemptId: 1,
          problem: state.attempts[0].problem,
          steps: state.attempts[0].steps,
          contextRevision: state.attempts[0].contextRevision,
          contextSignature: state.attempts[0].contextSignature,
          firstInvalidIndex: 2,
          category: "distribution",
          governingRule: fixture.governingRule,
          result: hint,
        },
      ],
      completedTransfer,
    );
    expect(snapshot.diagnosis).toMatchObject({
      attemptId: 1,
      firstInvalidIndex: 2,
      category: "distribution",
    });
    expect(snapshot.hint?.result.provenance).toBe("reviewed judge fixture");
    expect(snapshot.attempts).toHaveLength(2);
    expect(snapshot.attempts[0].steps[1]).toBe("3 * x + 2 = 18");
    expect(snapshot.attempts[1].steps[1]).toBe("3 * x + 6 = 18");
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.attempts)).toBe(true);
    expect(Object.isFrozen(snapshot.attempts[0].steps)).toBe(true);
  });

  it("derives custom clean work from equation structure without fixture authority", () => {
    let state = sessionReducer(initialSessionState, {
      type: "load",
      problem: "5 * (x - 1) = 20",
      steps: ["5 * (x - 1) = 20", "5 * x - 5 = 20", "x = 5"],
    });
    state = complete(state, "custom-clean").state;
    const transfer = beginTransfer(state)!;
    expect(transfer.problem.skillTag).toBe("distribution");
    expect(beginTransfer(state)?.problem).toEqual(transfer.problem);
  });

  it("does not inherit an edited seeded fixture or a stale prior-context diagnosis", () => {
    const fixture = getFixture("sign-equality-first-wrong-step")!;
    let state = sessionReducer(initialSessionState, {
      type: "load",
      problem: fixture.problem,
      steps: fixture.steps,
    });
    state = complete(state, "old-diagnosis").state;
    state = sessionReducer(state, {
      type: "set_step",
      index: 0,
      value: "2 * x = 8",
    });
    state = sessionReducer(state, { type: "remove_step", index: 2 });
    state = sessionReducer(state, {
      type: "set_step",
      index: 1,
      value: "x = 4",
    });
    state = complete(state, "edited-clean").state;
    expect(beginTransfer(state)?.problem.skillTag).toBe("inverse_operation");
  });

  it("uses a repaired immutable diagnosis but invalidates it on fixture switch", () => {
    const distribution = getFixture("distribution-first-wrong-step")!;
    let state = sessionReducer(initialSessionState, {
      type: "load",
      problem: distribution.problem,
      steps: distribution.steps,
    });
    state = complete(state, "distribution-diagnosis").state;
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
    state = complete(state, "distribution-repaired").state;
    expect(beginTransfer(state)?.problem.skillTag).toBe("distribution");

    const clean = getFixture("fully-valid-isolation")!;
    state = sessionReducer(state, {
      type: "load",
      problem: clean.problem,
      steps: clean.steps,
    });
    state = complete(state, "switched-clean").state;
    expect(state.attempts).toHaveLength(1);
    expect(beginTransfer(state)?.problem.skillTag).toBe("inverse_operation");
  });

  it.each([
    { problem: "x = x + 1", steps: ["x = x + 1"] },
    { problem: "2 * x = 2 * x", steps: ["2 * x = 2 * x"] },
    { problem: "2 * x + 2 = 8", steps: ["2 * x = 6"] },
  ])(
    "offers no transfer for boundary or in-progress work: $problem",
    (input) => {
      let state = sessionReducer(initialSessionState, {
        type: "load",
        ...input,
      });
      state = complete(state, `blocked-${input.problem}`).state;
      expect(beginTransfer(state)).toBeNull();
    },
  );
});
