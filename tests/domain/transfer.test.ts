import { describe, expect, it } from "vitest";
import { analyze } from "../../src/domain/analyze";
import {
  deriveEquationSkill,
  generateTransfer,
  scoreTransfer,
  type TransferContext,
} from "../../src/domain/transfer";

const contexts: readonly TransferContext[] = [
  {
    contextKey: "distribution-repaired",
    skillTag: "distribution",
    originalProblem: "3 * (x + 2) = 18",
    originalSolution: "4",
  },
  {
    contextKey: "equality-repaired",
    skillTag: "equality_preservation",
    originalProblem: "2 * x + 3 = 11",
    originalSolution: "4",
  },
  {
    contextKey: "valid-isolation",
    skillTag: "inverse_operation",
    originalProblem: "4 * x + 8 = 24",
    originalSolution: "4",
  },
];

describe("SLICE-003 deterministic transfer", () => {
  it.each(contexts)(
    "generates a changed, same-skill, bounded unique problem for $skillTag",
    (context) => {
      const first = generateTransfer(context);
      const repeated = generateTransfer(context);
      expect(repeated).toEqual(first);
      expect(first.skillTag).toBe(context.skillTag);
      expect(first.equation.replaceAll(" ", "")).not.toBe(
        context.originalProblem.replaceAll(" ", ""),
      );
      expect(first.expectedSolution).not.toBe(context.originalSolution);
      expect(first.equation.length).toBeLessThanOrEqual(32);
      expect(first.equation).toMatch(/^[0-9x+*() =-]+$/u);
      const proof = analyze({
        problem: first.equation,
        steps: [first.equation, `x = ${first.expectedSolution}`],
      });
      expect(proof).toMatchObject({
        kind: "valid_complete",
        solutionSet: { kind: "unique", value: first.expectedSolution },
      });
    },
  );

  it("scores exact equivalent rationals independently from pedagogy", () => {
    const transfer = generateTransfer(contexts[0]);
    expect(scoreTransfer(transfer, transfer.expectedSolution)).toBe("mastered");
    const equivalent = `${BigInt(transfer.expectedSolution) * 2n}/2`;
    expect(scoreTransfer(transfer, equivalent)).toBe("mastered");
    expect(scoreTransfer(transfer, "999")).toBe("needs_practice");
    expect(scoreTransfer(transfer, "not an equation")).toBe("needs_practice");
    expect(scoreTransfer(transfer, "9".repeat(49))).toBe("needs_practice");
  });

  it("derives a stable skill from the actual supported equation structure", () => {
    expect(deriveEquationSkill("5 * (x - 1) = 20")).toBe("distribution");
    expect(deriveEquationSkill("5 * x - 5 = 20")).toBe("inverse_operation");
    expect(deriveEquationSkill("x = x + 1")).toBeNull();
    expect(deriveEquationSkill("2 * x = 2 * x")).toBeNull();
    expect(deriveEquationSkill("x ** 2 = 4")).toBeNull();
  });
});
