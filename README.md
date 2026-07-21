# First Wrong Step

First Wrong Step is an Education-track web demo that helps a learner repair typed, step-by-step work on one-variable linear equations. It finds the **first transformation that changes the equation's solution set**, gives a restrained hint, and checks learning on a structurally equivalent transfer problem.

The mathematical decision path is deterministic and exact. The public judge mode needs no API key: its hints are reviewed static pedagogy fixtures that were assisted by GPT-5.6 during development. GPT-5.6 does not decide whether a step is valid, whether an answer is correct, or whether mastery was achieved.

## Try the full judge flow

1. Open the app from this repository's **Website** link.
2. Load a synthetic example such as **Distribution diagnosis**.
3. Select **Check my reasoning**. The first invalid transition is highlighted; later work is intentionally not evaluated yet.
4. Read the small, answer-withholding hint, edit the incorrect equation line, and check again.
5. Complete the equivalent transfer problem. Its answer and mastery state are checked deterministically.
6. Open **Evidence** to see the current in-memory attempt trail and **How it was built** for Build Week provenance.
7. Use **Reset work** to clear the active session.

Use synthetic algebra only. Do not enter names, student identifiers, or other personal information. Learner work stays in the current browser memory; the app has no accounts, analytics, cookies, learner database, or live-model dependency.

## Run locally

Prerequisites: Node.js `24.18.0` and npm `11.16.0` as declared in `package.json`.

```bash
npm ci --ignore-scripts
npm run build
npm start
```

Then open `http://127.0.0.1:8080`. Health is available at `GET /healthz`.

Useful verification commands:

```bash
npm test
npm run lint
npm run typecheck
npm run smoke:production
```

## How Codex and GPT-5.6 were used

The creator first designed and refined a reusable **Greenfield Software Factory** skill inside Codex using **GPT-5.6 Sol with ultra reasoning**. The skill encodes a disciplined workflow: baseline a PRD, decide the architecture, plan small vertical slices, assign bounded implementation work, freeze source fingerprints, collect independent reviews, and retain traceable evidence.

The creator then invoked that skill to build this project. Codex coordinated the factory run while GPT-5.6 Sol ultra helped reason through the product specification, architecture, repair decisions, test design, and reviewed teaching copy. The runtime boundary remains deliberately narrow: exact rational algebra code owns correctness; model-assisted content is versioned, static, reviewed, and replaceable with deterministic fallback copy.

The auditable design material is included under `.factory/`: the [product specification](.factory/product-spec.md), [architecture](.factory/architecture.md), [decisions](.factory/decisions/), [feature plan](.factory/feature-plan.json), and [traceability matrix](.factory/traceability.md).

## Honest release status

This public handoff intentionally prioritizes an immutable repository and a minimal Cloud Run judge deployment. The user explicitly skipped the broader Slice 5 release-certification wave and the Substack post. Therefore this repository does **not** claim fresh final certification for accessibility, supply-chain safety, container scanning, hosted privacy/log retention, hosted performance, or rollback readiness. Earlier slice-level tests and UI evidence exist locally, but generated factory reports and evidence are intentionally excluded from the public repository.

See [BUILD_AND_SUBMISSION.md](BUILD_AND_SUBMISSION.md) for submission boundaries and reproducibility notes.

## Scope

Supported input is one-variable linear algebra with integers or rational constants, `+`, `-`, multiplication, division by a nonzero constant, parentheses, and equality. Handwriting/OCR, nonlinear equations, accounts, classroom rosters, grades, analytics, and real student records are outside this demo.

## License

First Wrong Step is available under the [MIT License](LICENSE).
