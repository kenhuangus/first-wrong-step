# DEC-001 — Modular TypeScript monolith

- Status: proposed for architecture review
- Date: 2026-07-20
- Supersedes: none

## Context

The MVP needs one responsive browser workflow, deterministic local computation, and bundled synthetic content. It has no accounts, database, cross-user sharing, provider boundary, or independent scaling requirement.

## Decision

Use one TypeScript repository and one deployable artifact: React 19.2.7 built by Vite 8.1.5, a framework-independent domain/application core, and a minimal Node 24 built-in HTTP host. Keep browser, domain, content, and static-host adapters as modules with inward dependency direction.

The host serves only build-manifest entries after strict one-pass request-target validation, symlink-free component walking, canonical `realpath` containment beneath an immutable opened `dist` root, bounded regular-file verification, and explicit MIME/size checks. SPA fallback is limited to `/`, `/evidence`, and `/build` with an HTML `Accept`; arbitrary extensionless and asset paths never fall back. The client uses reducer-only panels: those three direct URLs select an initial panel, while in-app switches do not mutate URL/history and focus the destination heading.

## Consequences

One language and lockfile reduce integration and deployment cost. Domain tests run without a browser, while E2E tests exercise the same production build. The Node host requires a traversal corpus, immutable manifest, and containment tests. The panel model deliberately gives up shareable in-session view URLs and Back/Forward panel history; document navigation/reload clears ephemeral work by contract.

## Rejected alternatives

- Next.js/server components: adds routing/rendering/session surfaces with no requirement benefit.
- Python API plus React client: creates two runtimes/contracts for a browser-local deterministic core.
- Microservices: no scale or isolation constraint justifies distributed operations.
