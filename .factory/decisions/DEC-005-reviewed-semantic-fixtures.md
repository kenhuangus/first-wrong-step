# DEC-005 — Versioned reviewed semantic fixtures

- Status: proposed for architecture review
- Date: 2026-07-20
- Supersedes: none

## Context

Schema-valid pedagogy may still be mathematically false or irrelevant. Seeded examples and deterministic fallbacks are the public judge baseline and require reproducible evidence that the category, rule, and hint agree with the first invalid transition.

## Decision

Ship versioned synthetic fixtures with expected first-invalid index, category, governing rule, allowed/forbidden concepts, GPT-5.6 Sol-assisted pedagogy and deterministic fallback asset IDs, validated transfer item, and an owner-review record with content/evidence digests. Build tests reject missing reviews, semantic mismatch, answer leakage, unsupported transfer items, or a failed rubric field. Include a deliberately swapped-rule test fixture that must fail. Provenance identifies assisted authorship through Codex/factory artifacts and never represents a fixture as a live runtime call.

## Consequences

Judge behavior is reproducible without a key, and GPT-5.6-assisted authorship is distinguished from a live call. Content updates require semantic review and digest renewal. Arbitrary user inputs may receive `unclassified` deterministic fallback when evidence does not safely map to a reviewed rule.

## Rejected alternatives

- Free-form prompt files without golden contracts: cannot prove relevance or detect swapped guidance.
- Category based solely on model output: turns pedagogy into a hidden correctness oracle.
