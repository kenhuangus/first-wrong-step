# DEC-004 — Bounded, fail-closed pedagogy adapters

- Status: proposed for architecture review
- Date: 2026-07-20
- Supersedes: none

## Context

The demo must explain GPT-5.6 use yet work without a paid key or network. Optional live output is untrusted, can leak answers or teach the wrong rule, and can be abused for cost.

## Decision

Define one `PedagogyAdapter` with production `JudgeFixtureAdapter` and `DeterministicFallbackAdapter` implementations only. Judge mode makes no model or provider request. Both consume closed enum-coded validator evidence and return content through the same schema, active-content, answer-restraint, and semantic policy. A test-only counted adapter simulates timeout, invalid output, unavailable, duplicate completion, and retry success without network or credentials.

The one-day MVP has no live adapter, `/api/pedagogy` handler, provider package, model/endpoint configuration, API key, rate/source key, request deduplication, quota/spend ledger, persistent volume, DNS/TLS/redirect client, or provider operations tests. `NFR-009` and `AC-026` are conditional/not applicable because the live-profile precondition is false; release evidence must prove these surfaces are absent. `AC-015` and `AC-032` remain mandatory through in-process failure simulation.

The Build panel and review manifest state accurately that the user created and invoked the Greenfield Software Factory through Codex using GPT-5.6 Sol ultra, and that shipped reviewed assets are GPT-5.6-assisted rather than live responses. A future real-provider feature requires a superseding decision, expanded plan, and every conditional security/cost/privacy control in the frozen specification, including a deployment-specific trusted-source resolver.

## Consequences

The core journey is reliable, feasible in one day, and factual about provenance. There is no provider attack/cost surface or provider credential to protect in this artifact. The tradeoff is that arbitrary user input may use deterministic fallback rather than live generated pedagogy; adding live generation is a future scoped feature, not a configuration toggle.

## Rejected alternatives

- Direct browser provider calls: exposes credentials and creates an unnecessary network boundary.
- Required or optional live API in this MVP: makes judging/delivery depend on key, network, quota, and substantial operations work.
- Field-by-field repair of malformed output: can combine contradictory or unsafe content.
