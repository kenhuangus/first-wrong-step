import { describe, expect, it } from "vitest";
import {
  initialSessionState,
  sessionContextSignature,
  sessionReducer,
} from "../../src/app/session-reducer";
import { beginTransfer } from "../../src/app/transfer-use-case";
import type { AnalysisResult } from "../../src/contracts/analysis";
import type { SessionState } from "../../src/contracts/session";
import { analyze } from "../../src/domain/analyze";
import { selectTeacherEvidence } from "../../src/ui/evidence/evidence-selectors";

const A = {
  problem: "2 * x + 3 = 11",
  invalid: ["2 * x + 3 = 11", "2 * x = 14", "x = 7"],
  repaired: ["2 * x + 3 = 11", "2 * x = 8", "x = 4"],
} as const;
const B = {
  problem: "5 * (x - 1) = 20",
  clean: ["5 * (x - 1) = 20", "5 * x - 5 = 20", "x = 5"],
  invalid: ["5 * (x - 1) = 20", "5 * x - 1 = 20", "x = 21 / 5"],
} as const;

function accepted(state: SessionState, requestId: string): SessionState {
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

function load(
  state: SessionState,
  problem: string,
  steps: readonly string[],
): SessionState {
  return sessionReducer(state, { type: "load", problem, steps });
}

function replace(
  state: SessionState,
  problem: string,
  steps: readonly string[],
): SessionState {
  state = sessionReducer(state, { type: "set_problem", value: problem });
  while (state.steps.length > steps.length)
    state = sessionReducer(state, {
      type: "remove_step",
      index: state.steps.length - 1,
    });
  while (state.steps.length < steps.length)
    state = sessionReducer(state, { type: "add_step" });
  for (const [index, value] of steps.entries())
    state = sessionReducer(state, { type: "set_step", index, value });
  return state;
}

function diagnoseA(): SessionState {
  return accepted(
    load(initialSessionState, A.problem, A.invalid),
    "diagnose-a",
  );
}

function returnToCleanA(state: SessionState): SessionState {
  return accepted(replace(state, A.problem, A.repaired), "return-clean-a");
}

describe("explicit uninterrupted repair lineage", () => {
  it("consumes one immediate same-problem repair edge after multiple allowed edits", () => {
    let state = diagnoseA();
    expect(state.pendingRepair?.diagnosisAttemptId).toBe(1);
    state = sessionReducer(state, {
      type: "set_step",
      index: 1,
      value: "2 * x = 8",
    });
    state = sessionReducer(state, {
      type: "set_step",
      index: 2,
      value: "x = 4",
    });
    state = accepted(state, "repair-a");

    expect(state.attempts.at(-1)?.repairOfAttemptId).toBe(1);
    expect(state.pendingRepair).toBeNull();
    expect(beginTransfer(state)?.problem.skillTag).toBe(
      "equality_preservation",
    );
    expect(
      selectTeacherEvidence(state, [], beginTransfer(state)).diagnosis,
    ).toMatchObject({ attemptId: 1, category: "equality_preservation" });
  });

  it("does not revive A after an accepted clean B intervenes", () => {
    let state = diagnoseA();
    state = accepted(replace(state, B.problem, B.clean), "clean-b");
    state = returnToCleanA(state);

    expect(state.attempts.at(-1)?.repairOfAttemptId).toBeUndefined();
    expect(beginTransfer(state)?.problem.skillTag).toBe("inverse_operation");
    const evidence = selectTeacherEvidence(state, [], beginTransfer(state));
    expect(evidence.diagnosis).toBeNull();
    expect(evidence.hint).toBeNull();
    expect(evidence.attempts.map((attempt) => attempt.id)).toEqual([1, 2, 3]);
  });

  it("does not revive A after an accepted invalid B intervenes", () => {
    let state = diagnoseA();
    state = accepted(replace(state, B.problem, B.invalid), "invalid-b");
    state = returnToCleanA(state);

    expect(state.attempts.at(-1)?.repairOfAttemptId).toBeUndefined();
    expect(beginTransfer(state)?.problem.skillTag).toBe("inverse_operation");
    expect(
      selectTeacherEvidence(state, [], beginTransfer(state)).diagnosis,
    ).toBeNull();
  });

  it.each(["switch", "reset"])(
    "breaks A lineage across a %s even when identical A returns",
    (boundary) => {
      let state = diagnoseA();
      state =
        boundary === "switch"
          ? load(state, B.problem, B.clean)
          : sessionReducer(state, { type: "reset" });
      state = returnToCleanA(state);

      expect(state.attempts.at(-1)?.repairOfAttemptId).toBeUndefined();
      expect(beginTransfer(state)?.problem.skillTag).toBe("inverse_operation");
      expect(
        selectTeacherEvidence(state, [], beginTransfer(state)).diagnosis,
      ).toBeNull();
    },
  );

  it("breaks the token on an unrelated prefix edit and never resurrects it", () => {
    let state = diagnoseA();
    state = sessionReducer(state, {
      type: "set_step",
      index: 0,
      value: "2 * x + 3 = 11 + 0",
    });
    expect(state.pendingRepair).toBeNull();
    state = sessionReducer(state, {
      type: "set_step",
      index: 0,
      value: A.repaired[0],
    });
    state = sessionReducer(state, {
      type: "set_step",
      index: 1,
      value: A.repaired[1],
    });
    state = sessionReducer(state, {
      type: "set_step",
      index: 2,
      value: A.repaired[2],
    });
    state = accepted(state, "clean-after-unrelated-edit");

    expect(state.attempts.at(-1)?.repairOfAttemptId).toBeUndefined();
    expect(beginTransfer(state)?.problem.skillTag).toBe("inverse_operation");
  });

  it.each([
    {
      name: "in-progress",
      steps: ["2 * x + 3 = 11", "2 * x = 8"],
    },
    { name: "boundary", problem: "x = x", steps: ["x = x"] },
  ])("breaks the token on an intervening accepted $name analysis", (next) => {
    let state = diagnoseA();
    state = accepted(
      replace(state, next.problem ?? A.problem, next.steps),
      `accepted-${next.name}`,
    );
    state = returnToCleanA(state);
    expect(state.attempts.at(-1)?.repairOfAttemptId).toBeUndefined();
    expect(beginTransfer(state)?.problem.skillTag).toBe("inverse_operation");
  });

  it("clears the token on failed analysis and ignores stale or duplicate completions", () => {
    let state = diagnoseA();
    state = sessionReducer(state, {
      type: "set_step",
      index: 1,
      value: A.repaired[1],
    });
    const request = {
      requestId: "failed-repair",
      contextRevision: state.contextRevision,
      contextSignature: sessionContextSignature(state.problem, state.steps),
    };
    state = sessionReducer(state, { type: "analysis_started", ...request });
    state = sessionReducer(state, { type: "analysis_failed", ...request });
    expect(state.pendingRepair).toBeNull();

    const stale = sessionReducer(state, {
      type: "analysis_completed",
      result: analyze({ problem: state.problem, steps: state.steps }),
      ...request,
    });
    expect(stale).toBe(state);
    state = sessionReducer(state, {
      type: "set_step",
      index: 2,
      value: A.repaired[2],
    });
    state = accepted(state, "clean-after-failure");
    const duplicate = sessionReducer(state, {
      type: "analysis_completed",
      result: state.analysis!,
      requestId: "clean-after-failure",
      contextRevision: state.contextRevision,
      contextSignature: sessionContextSignature(state.problem, state.steps),
    });
    expect(duplicate).toBe(state);
    expect(state.attempts.at(-1)?.repairOfAttemptId).toBeUndefined();
  });

  it("does not let a forged diagnosis result create a consumable edge", () => {
    let state = load(initialSessionState, A.problem, A.invalid);
    const request = {
      requestId: "forged",
      contextRevision: state.contextRevision,
      contextSignature: sessionContextSignature(state.problem, state.steps),
    };
    const real = analyze({ problem: state.problem, steps: state.steps });
    if (real.kind !== "needs_repair") throw new Error("fixture");
    const forged: AnalysisResult = {
      ...real,
      firstInvalidIndex: 1,
    };
    state = sessionReducer(state, { type: "analysis_started", ...request });
    state = sessionReducer(state, {
      type: "analysis_completed",
      result: forged,
      ...request,
    });
    state = sessionReducer(state, {
      type: "set_step",
      index: 1,
      value: A.repaired[1],
    });
    state = sessionReducer(state, {
      type: "set_step",
      index: 2,
      value: A.repaired[2],
    });
    state = accepted(state, "after-forgery");

    expect(state.attempts.at(-1)?.repairOfAttemptId).toBeUndefined();
    expect(beginTransfer(state)?.problem.skillTag).toBe("inverse_operation");
  });
});
