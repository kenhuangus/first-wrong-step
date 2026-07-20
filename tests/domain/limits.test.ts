import { describe, expect, it } from "vitest";
import { analyze, analyzeReasoning } from "../../src/domain/analyze";
import { lex } from "../../src/domain/lexer";
import {
  AnalysisBudget,
  LIMITS,
  preflightInput,
} from "../../src/domain/limits";
describe("bounded analysis", () => {
  it("enforces the step boundary", () => {
    expect(
      analyze({
        problem: "x=1",
        steps: Array.from({ length: 12 }, () => "x=1"),
      }).kind,
    ).toBe("valid_complete");
    const above = analyze({
      problem: "x=1",
      steps: Array.from({ length: 13 }, () => "x=1"),
    });
    expect(above.kind).toBe("input_error");
    expect(above.lines[0]).toMatchObject({
      kind: "too_complex",
      limit: "step_count",
    });
  });
  it("enforces line and total character boundaries", () => {
    const atLine = `x=1${" ".repeat(253)}`;
    expect(atLine.length).toBe(LIMITS.maxLineCharacters);
    expect(lex(atLine, new AnalysisBudget())).toBeDefined();
    expect(() => lex(`${atLine} `, new AnalysisBudget())).toThrow(
      expect.objectContaining({ limit: "line_characters" }),
    );
    const lines = Array.from({ length: 12 }, () => `x=1${" ".repeat(232)}`);
    expect(() => preflightInput(`x=1${" ".repeat(232)}`, lines)).not.toThrow();
    expect(() =>
      preflightInput(
        `x=1${" ".repeat(236)}`,
        Array.from({ length: 12 }, () => `x=1${" ".repeat(236)}`),
      ),
    ).toThrow(expect.objectContaining({ limit: "total_characters" }));
  });
  it("enforces token, digit, and nesting boundaries", () => {
    const tokenSource = `${"+".repeat(124)}x=1`;
    expect(lex(tokenSource, new AnalysisBudget())).toBeDefined();
    expect(() => lex(`${"+".repeat(126)}x=1`, new AnalysisBudget())).toThrow(
      expect.objectContaining({ limit: "tokens" }),
    );
    expect(lex("x=123456789012", new AnalysisBudget())).toBeDefined();
    expect(() => lex("x=1234567890123", new AnalysisBudget())).toThrow(
      expect.objectContaining({ limit: "numeric_digits" }),
    );
    expect(
      lex(`${"(".repeat(8)}x${")".repeat(8)}=1`, new AnalysisBudget()),
    ).toBeDefined();
    expect(() =>
      lex(`${"(".repeat(9)}x${")".repeat(9)}=1`, new AnalysisBudget()),
    ).toThrow(expect.objectContaining({ limit: "parenthesis_depth" }));
  });
  it("enforces per-line and total node boundaries before extra work", () => {
    const lineBudget = new AnalysisBudget();
    for (let index = 1; index <= 96; index += 1) lineBudget.addNode(index);
    expect(() => lineBudget.addNode(97)).toThrow(
      expect.objectContaining({ limit: "line_nodes" }),
    );
    const totalBudget = new AnalysisBudget();
    for (let index = 0; index < 768; index += 1) totalBudget.addNode(1);
    expect(() => totalBudget.addNode(1)).toThrow(
      expect.objectContaining({ limit: "total_nodes" }),
    );
  });
  it("exercises the per-equation node ceiling through the public analyzer", () => {
    const witness = (nodes: number) => `${"-".repeat(nodes - 2)}x=0`;
    const atLimit = analyzeReasoning({
      problem: witness(96),
      steps: ["x=0", "x=0"],
    });
    expect(atLimit.kind).toBe("valid_complete");

    const input = {
      problem: witness(97),
      steps: ["x=0", "x=0"],
    } as const;
    const before = structuredClone(input);
    const aboveLimit = analyzeReasoning(input);
    expect(aboveLimit.kind).toBe("input_error");
    expect(aboveLimit.lines[0]).toEqual({
      kind: "too_complex",
      lineIndex: 0,
      limit: "line_nodes",
      message: "Input too complex—shorten this equation or solution",
    });
    expect(input).toEqual(before);
    expect(JSON.stringify(aboveLimit)).not.toContain(input.problem);
    expect(JSON.stringify(aboveLimit)).not.toMatch(
      /misconception|category|governingRule|hint|explanation|pedagogy|provenance/i,
    );
  });
  it("exercises the total node ceiling through the public analyzer", () => {
    const witness = (nodes: number) => `${"-".repeat(nodes - 2)}x=0`;
    const atLimitNodes = [96, 96, 96, 96, 96, 96, 96, 94, 2];
    const aboveLimitNodes = [96, 96, 96, 96, 96, 96, 96, 95, 2];
    const makeInput = (nodes: readonly number[]) => {
      const [problemNodes, ...stepNodes] = nodes;
      if (problemNodes === undefined) throw new Error("A problem is required.");
      return {
        problem: witness(problemNodes),
        steps: stepNodes.map(witness),
      };
    };

    const atLimitInput = makeInput(atLimitNodes);
    expect(atLimitInput.steps).toHaveLength(8);
    expect(
      [atLimitInput.problem, ...atLimitInput.steps].reduce(
        (total, line) => total + line.length,
        0,
      ),
    ).toBe(777);
    expect(analyzeReasoning(atLimitInput).kind).toBe("valid_complete");

    const aboveLimitInput = makeInput(aboveLimitNodes);
    const before = structuredClone(aboveLimitInput);
    const aboveLimit = analyzeReasoning(aboveLimitInput);
    expect(
      [aboveLimitInput.problem, ...aboveLimitInput.steps].every(
        (line) => line.length <= 97,
      ),
    ).toBe(true);
    expect(
      [aboveLimitInput.problem, ...aboveLimitInput.steps].reduce(
        (total, line) => total + line.length,
        0,
      ),
    ).toBe(778);
    expect(aboveLimit.kind).toBe("input_error");
    expect(aboveLimit.lines[8]).toEqual({
      kind: "too_complex",
      lineIndex: 8,
      limit: "total_nodes",
      message: "Input too complex—shorten this equation or solution",
    });
    expect(aboveLimitInput).toEqual(before);
    expect(JSON.stringify(aboveLimit)).not.toContain(aboveLimitInput.problem);
    expect(JSON.stringify(aboveLimit)).not.toMatch(
      /misconception|category|governingRule|hint|explanation|pedagogy|provenance/i,
    );
  });
  it("enforces wall-time and work-unit boundaries", () => {
    let now = 0;
    const timed = new AnalysisBudget(() => now);
    now = 500;
    expect(() => timed.charge()).not.toThrow();
    now = 501;
    expect(() => timed.charge()).toThrow(
      expect.objectContaining({ limit: "wall_time" }),
    );
    const worked = new AnalysisBudget(() => 0);
    worked.charge(20_000);
    expect(() => worked.charge()).toThrow(
      expect.objectContaining({ limit: "work_units" }),
    );
  });
  it("rejects huge coefficients and forced budgets without throwing raw input", () => {
    const huge = analyze({ problem: "x=1234567890123", steps: ["x=1", "x=1"] });
    expect(JSON.stringify(huge)).not.toContain("1234567890123");
    expect(huge.kind).toBe("input_error");
    expect(huge.lines[0]).toMatchObject({
      kind: "too_complex",
      limit: "numeric_digits",
    });
    const forced = new AnalysisBudget(() => 0);
    forced.charge(20_000);
    const result = analyze(
      { problem: "x=1", steps: ["x=1", "x=1"] },
      { budget: forced },
    );
    expect(result.kind).toBe("input_error");
    expect(result.lines[0]).toMatchObject({
      kind: "too_complex",
      limit: "work_units",
    });
  });
});
