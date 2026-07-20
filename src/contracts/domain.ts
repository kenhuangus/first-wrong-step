export type Rational = Readonly<{ numerator: bigint; denominator: bigint }>;
export type RationalText = string;
export type BinaryOperator = "+" | "-" | "*" | "/";
export type Expression =
  | Readonly<{ kind: "number"; value: Rational }>
  | Readonly<{ kind: "variable" }>
  | Readonly<{ kind: "unary"; operator: "+" | "-"; operand: Expression }>
  | Readonly<{
      kind: "binary";
      operator: BinaryOperator;
      left: Expression;
      right: Expression;
    }>;
export type EquationAst = Readonly<{ left: Expression; right: Expression }>;
export type Affine = Readonly<{ coefficient: Rational; constant: Rational }>;
export type SolutionSet =
  | Readonly<{ kind: "unique"; value: RationalText }>
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "all_real" }>;
export type Category =
  | "distribution"
  | "combining_like_terms"
  | "sign_handling"
  | "inverse_operation"
  | "division_multiplication"
  | "equality_preservation"
  | "unclassified";
export type InputErrorCode =
  | "empty"
  | "malformed"
  | "unsupported_character"
  | "second_variable"
  | "nonlinear"
  | "variable_denominator"
  | "zero_denominator";
export type LimitCode =
  | "step_count"
  | "line_characters"
  | "total_characters"
  | "tokens"
  | "numeric_digits"
  | "parenthesis_depth"
  | "line_nodes"
  | "total_nodes"
  | "wall_time"
  | "work_units";
