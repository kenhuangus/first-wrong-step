# DEC-002 — Exact rational linear validator

- Status: proposed for architecture review
- Date: 2026-07-20
- Supersedes: none

## Context

Mathematical validity and mastery must be deterministic across equivalent forms, including unique, no-solution, and all-real solution sets. Input is tightly limited to one-variable linear equations and must resist complexity attacks.

## Decision

Implement a project-owned closed lexer/parser and exact rational affine normalizer. Represent every expression as `a*x+b` using reduced `BigInt` rationals, classify the equation solution set exactly, and compare tagged solution sets. Enforce lexical, AST, work, and wall-time budgets before/during normalization. The LLM never participates in correctness.

Division's right operand is exactly one `constantUnary`, which is either a signed integer or a parenthesized constant-only expression under the explicit constant grammar. Consequently `x/2+3` is `(x/2)+3`; `x/(2+3)` is required to divide by a sum; variable-containing and exact-zero denominators are unsupported. `*` and `/` are left-associative at equal precedence, while unary signs associate right. These examples and rejection boundaries are parser contract fixtures, not implementation discretion.

## Consequences

The algorithm is auditable, deterministic, fast for the bounded subset, and free of floating-point drift. The team owns a security-sensitive parser and therefore must provide dense grammar-ambiguity, denominator, boundary, mutation, and regression tests. Expansion beyond the frozen grammar or linear equations requires a new decision.

## Rejected alternatives

- Floating-point coefficient comparison: cannot provide exact repeated outcomes.
- General computer algebra dependency: substantially larger parser/supply-chain surface for a deliberately small grammar.
- GPT-5.6 grading: violates the deterministic correctness boundary.
