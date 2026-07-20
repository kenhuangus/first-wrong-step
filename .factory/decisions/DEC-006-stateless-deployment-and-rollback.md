# DEC-006 — Stateless deployment and digest rollback

- Status: proposed for architecture review
- Date: 2026-07-20
- Supersedes: none

## Context

The submission needs a reliable public demo with no database, learner retention, or provider subsystem. Static assets and health need a simple rollback path.

## Decision

Package the Vite build and minimal Node host into one immutable, non-root OCI image (or equivalent immutable artifact). Public judge mode contains no provider secret, live flag, pricing/quota/budget configuration, or writable application state. Use `/healthz`, structured metadata-only stdout logs, shortest platform retention not exceeding seven days, and security headers. Roll back by restoring the prior image digest; fixtures and code move together.

No real-provider mode is included or configurable. The image has no provider credential/configuration, outbound provider client, quota/spend journal, or persistent volume. Any future provider-enabled image is a different reviewed architecture and release artifact.

## Consequences

There are no learner-data or operational-journal migrations, backups, or restore steps. Judge mode can scale because it is entirely stateless. Deployment/platform configuration still requires independent operational and privacy verification.

## Rejected alternatives

- Database-backed deployment: no required persistent entity exists.
- CDN-only build: cannot guarantee the selected uniform health and traversal-safe header/route behavior without a separately verified hosting contract.
- Mutable in-place releases: weaken provenance and rollback evidence.
