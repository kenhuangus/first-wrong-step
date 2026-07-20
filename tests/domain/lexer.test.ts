import { describe, expect, it } from "vitest";
import { lex } from "../../src/domain/lexer";
import { AnalysisBudget } from "../../src/domain/limits";
describe("closed lexer", () => {
  it("covers every supported operator", () => {
    expect(
      lex("-(x + 2) * 3 / 2 = +4", new AnalysisBudget()).map(
        (token) => token.kind,
      ),
    ).toEqual([
      "minus",
      "left_paren",
      "variable",
      "plus",
      "number",
      "right_paren",
      "star",
      "number",
      "slash",
      "number",
      "equals",
      "plus",
      "number",
      "eof",
    ]);
  });
  it.each([
    ["x + y = 2", "second_variable"],
    ["x² = 4", "unsupported_character"],
    ["", "empty"],
  ])("rejects %s", (source, code) => {
    try {
      lex(source, new AnalysisBudget());
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toMatchObject({ code });
    }
  });
});
