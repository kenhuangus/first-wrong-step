import { ComplexityError, InputError } from "./errors";
import { LIMITS, type AnalysisBudget } from "./limits";
export type TokenKind =
  | "number"
  | "variable"
  | "plus"
  | "minus"
  | "star"
  | "slash"
  | "left_paren"
  | "right_paren"
  | "equals"
  | "eof";
export type Token = Readonly<{
  kind: TokenKind;
  lexeme: string;
  offset: number;
}>;
export function lex(source: string, budget: AnalysisBudget): Token[] {
  if (source.trim().length === 0)
    throw new InputError("empty", "Enter an equation on this line.");
  if (source.length > LIMITS.maxLineCharacters)
    throw new ComplexityError("line_characters");
  const tokens: Token[] = [];
  let depth = 0;
  for (let index = 0; index < source.length;) {
    budget.charge();
    const character = source[index] ?? "";
    if (/\s/u.test(character)) {
      index += 1;
      continue;
    }
    if (/[0-9]/u.test(character)) {
      const start = index;
      while (index < source.length && /[0-9]/u.test(source[index] ?? ""))
        index += 1;
      const lexeme = source.slice(start, index);
      if (lexeme.length > LIMITS.maxNumericDigits)
        throw new ComplexityError("numeric_digits");
      tokens.push({ kind: "number", lexeme, offset: start });
    } else if (character === "x") {
      tokens.push({ kind: "variable", lexeme: character, offset: index });
      index += 1;
    } else if (/[A-Za-z]/u.test(character)) {
      throw new InputError(
        "second_variable",
        "Only the variable x is supported in this equation.",
      );
    } else {
      const kinds: Partial<Record<string, TokenKind>> = {
        "+": "plus",
        "-": "minus",
        "*": "star",
        "/": "slash",
        "(": "left_paren",
        ")": "right_paren",
        "=": "equals",
      };
      const kind = kinds[character];
      if (!kind)
        throw new InputError(
          "unsupported_character",
          "Use integers, x, =, +, -, *, /, and parentheses only.",
        );
      if (kind === "left_paren") {
        depth += 1;
        if (depth > LIMITS.maxParenthesisDepth)
          throw new ComplexityError("parenthesis_depth");
      } else if (kind === "right_paren") {
        depth -= 1;
        if (depth < 0)
          throw new InputError(
            "malformed",
            "Check the parentheses on this line.",
          );
      }
      tokens.push({ kind, lexeme: character, offset: index });
      index += 1;
    }
    if (tokens.length > LIMITS.maxTokensPerEquation)
      throw new ComplexityError("tokens");
  }
  if (depth !== 0)
    throw new InputError("malformed", "Check the parentheses on this line.");
  tokens.push({ kind: "eof", lexeme: "", offset: source.length });
  return tokens;
}
