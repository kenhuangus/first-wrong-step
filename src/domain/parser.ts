import type { EquationAst, Expression } from "../contracts/domain";
import { InputError } from "./errors";
import { lex, type Token, type TokenKind } from "./lexer";
import { AnalysisBudget } from "./limits";
import { rational } from "./rational";
class Parser {
  private index = 0;
  private lineNodes = 0;
  public constructor(
    private readonly tokens: readonly Token[],
    private readonly budget: AnalysisBudget,
  ) {}
  public equation(): EquationAst {
    const left = this.expression();
    this.consume("equals", "An equation needs exactly one equals sign.");
    const right = this.expression();
    this.consume("eof", "Remove trailing or extra equation content.");
    return { left, right };
  }
  private expression(): Expression {
    let expression = this.term();
    while (this.matches("plus", "minus")) {
      const operator = this.previous().kind === "plus" ? "+" : "-";
      expression = this.node({
        kind: "binary",
        operator,
        left: expression,
        right: this.term(),
      });
    }
    return expression;
  }
  private term(): Expression {
    let expression = this.unary();
    while (this.current().kind === "star" || this.current().kind === "slash") {
      const operator = this.current().kind === "star" ? "*" : "/";
      this.index += 1;
      this.budget.charge();
      expression = this.node({
        kind: "binary",
        operator,
        left: expression,
        right: operator === "/" ? this.constantUnary() : this.unary(),
      });
    }
    return expression;
  }

  private constantExpression(): Expression {
    let expression = this.constantTerm();
    while (this.matches("plus", "minus")) {
      const operator = this.previous().kind === "plus" ? "+" : "-";
      expression = this.node({
        kind: "binary",
        operator,
        left: expression,
        right: this.constantTerm(),
      });
    }
    return expression;
  }

  private constantTerm(): Expression {
    let expression = this.constantUnary();
    while (this.current().kind === "star" || this.current().kind === "slash") {
      const operator = this.current().kind === "star" ? "*" : "/";
      this.index += 1;
      this.budget.charge();
      expression = this.node({
        kind: "binary",
        operator,
        left: expression,
        right: this.constantUnary(),
      });
    }
    return expression;
  }

  private constantUnary(): Expression {
    if (this.matches("plus", "minus")) {
      return this.node({
        kind: "unary",
        operator: this.previous().kind === "plus" ? "+" : "-",
        operand: this.constantUnary(),
      });
    }
    return this.constantPrimary();
  }

  private constantPrimary(): Expression {
    if (this.matches("number")) {
      return this.node({
        kind: "number",
        value: rational(BigInt(this.previous().lexeme)),
      });
    }
    if (this.current().kind === "variable") {
      throw new InputError(
        "variable_denominator",
        "Divide only by a constant that does not contain x.",
      );
    }
    if (this.matches("left_paren")) {
      const expression = this.constantExpression();
      this.consume(
        "right_paren",
        "Close this constant denominator expression.",
      );
      return expression;
    }
    throw new InputError(
      "malformed",
      "Enter a complete constant after the division sign.",
    );
  }
  private unary(): Expression {
    if (this.matches("plus", "minus"))
      return this.node({
        kind: "unary",
        operator: this.previous().kind === "plus" ? "+" : "-",
        operand: this.unary(),
      });
    return this.primary();
  }
  private primary(): Expression {
    if (this.matches("number"))
      return this.node({
        kind: "number",
        value: rational(BigInt(this.previous().lexeme)),
      });
    if (this.matches("variable")) return this.node({ kind: "variable" });
    if (this.matches("left_paren")) {
      const expression = this.expression();
      this.consume("right_paren", "Close this parenthesized expression.");
      return expression;
    }
    throw new InputError(
      "malformed",
      "Enter a complete supported expression on each side of =.",
    );
  }
  private node<T extends Expression>(value: T): T {
    this.lineNodes += 1;
    this.budget.addNode(this.lineNodes);
    return value;
  }
  private matches(...kinds: TokenKind[]): boolean {
    if (!kinds.includes(this.current().kind)) return false;
    this.index += 1;
    this.budget.charge();
    return true;
  }
  private consume(kind: TokenKind, message: string): void {
    if (!this.matches(kind)) throw new InputError("malformed", message);
  }
  private current(): Token {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1];
  }
  private previous(): Token {
    return this.tokens[this.index - 1];
  }
}
export function parseEquation(
  source: string,
  budget = new AnalysisBudget(),
): EquationAst {
  return new Parser(lex(source, budget), budget).equation();
}
