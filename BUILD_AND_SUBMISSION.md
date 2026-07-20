# Build and submission notes

## Product boundary

First Wrong Step is a separate Education-track project. It does not import or reuse CausalGate source, data, branding, or agent-governance workflow. Its purpose is equation-step diagnosis, corrective teaching, transfer practice, and compact current-session evidence.

## Reproducible commands

```bash
npm ci --ignore-scripts
npm test
npm run build
npm run smoke:production
```

The Cloud Run image is built from the committed `Dockerfile`. It runs the compiled static host as a non-root user, listens on the platform-provided `PORT`, exposes `/healthz`, and contains no API/provider key.

## AI development disclosure

The creator used Codex with GPT-5.6 Sol ultra reasoning to create and refine the Greenfield Software Factory skill, then invoked that skill for this project. The skill organized requirements, architecture, vertical-slice implementation, reviews, evidence, and release handoff. GPT-5.6-assisted teaching fixtures were reviewed and committed as static assets. Runtime algebra validation and mastery decisions are deterministic and do not call a model.

## Emergency-priority release scope

The user directed the factory to skip Slices 3, 4, and 5 and prioritize Slice 6 submission work. The current repository includes previously implemented learner diagnosis, safe hints, repair, transfer, evidence, and provenance behavior, but this emergency release does not convert skipped or unaccepted factory gates into passes.

Explicitly not claimed in this handoff:

- fresh full UI/accessibility certification;
- fresh full clean-room release certification;
- dependency/license/SBOM, container, or secret-scan certification;
- hosted performance budget evidence;
- hosted log-field and retention audit;
- production rollback exercise;
- Substack publication.

Public GitHub and Cloud Run targets are target-creation actions for the submission workflow, not substitutes for those checks. The immutable commit and deployment identity are retained in task-scoped factory evidence outside the public source tree.
