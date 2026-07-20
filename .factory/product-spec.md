# Product Specification — First Wrong Step (working name)

> **Naming status:** “First Wrong Step” is a reversible working name, not a final branding or availability claim.

## 1. Goal and outcome

Build an Education-track web application that helps a learner repair a typed, step-by-step solution to a one-variable linear equation by deterministically identifying the **first invalid transformation**, providing one minimal GPT-5.6-assisted pedagogical hint and misconception explanation, and verifying mastery with a different but structurally equivalent transfer problem. A teacher or judge can inspect the evidence trail without using real student data or a paid runtime API.

Success means a first-time judge can complete the full diagnose → repair → transfer → evidence loop using a seeded synthetic example in under three minutes, while mathematical validity and mastery are decided deterministically rather than by an LLM.

## 2. Build Week provenance and product boundary

The user created and invoked the **Greenfield Software Factory** Codex skill using **GPT-5.6 Sol with ultra reasoning**. The skill turns a product brief into baselined requirements, architecture, dependency-ordered vertical slices, implementation, independent reviews, and durable verification evidence. This factory run and its `.factory/` artifacts are part of the product’s OpenAI Build Week evidence and may be summarized in the product’s judge-facing “How it was built” view and submission materials.

This product is distinct from CausalGate: it has a new Education-track problem, repository, codebase, interface, data model, acceptance criteria, and learning workflow. It does not reuse CausalGate source code, data, branding, or its agent-governance workflow.

## 3. Actors and permissions

| Actor | Permissions | Prohibited or unavailable in MVP |
|---|---|---|
| Learner | Load a synthetic example; enter or edit typed equation steps; request analysis; receive a hint; submit a correction; attempt a transfer problem; reset the current session. | Cannot alter validator results, teacher evidence, system prompts, or Build Week provenance. |
| Teacher / judge | Use the same public judge-mode workflow; open a read-only evidence view for the current synthetic session; inspect steps, diagnosis, intervention, attempts, and mastery state. | Cannot edit learner work or mark mastery manually. No access to other sessions or identity data. |
| Demo operator | Start the app, select judge mode, inspect health/configuration status, and reset ephemeral demo state. | Cannot enable paid runtime calls without separately supplied configuration; cannot persist or export learner records in MVP. |

MVP has no accounts, class rosters, cross-user sharing, or privileged administration. “Teacher view” is a read-only presentation of the current browser session, not an authenticated school record system.

## 4. Scope

### In scope

- Responsive web UI for typed, ordered equation steps.
- A documented, resource-bounded expression subset: one variable (`x`), equality, integers or rational constants, `+`, `-`, multiplication, division by a nonzero constant, and parentheses; every supported equation must remain linear in `x`.
- Deterministic parsing and solution-set equivalence checks between consecutive steps.
- Identification of the earliest invalid step transition, with the prior and current step highlighted.
- Misconception categories limited to distribution, combining like terms, sign handling, inverse operation, division/multiplication, and equality preservation, plus an `unclassified` fallback.
- A minimal, answer-withholding hint and concise misconception explanation assisted by GPT-5.6, with visible provenance.
- Correction and re-analysis of the invalid step.
- One equivalent transfer problem and deterministic answer validation.
- Read-only evidence view for the current synthetic session.
- Public judge mode with seeded examples and pre-generated, reviewed GPT-5.6 pedagogical assets; no API key, payment, or real student data required.
- Explicit empty, loading, unsupported-input, service-unavailable, success, and reset states.
- Judge-facing Build Week provenance naming Codex, GPT-5.6 Sol ultra reasoning, and the invoked factory process.

### Non-goals

- Handwriting, image, OCR, speech, or document ingestion.
- Nonlinear equations, inequalities, systems, geometry, calculus, word-problem extraction, or proof grading.
- Open-ended chat, complete answer generation, or automated grades.
- Accounts, authentication, classrooms, rosters, assignments, analytics across learners, LMS/SIS integration, billing, or notifications.
- Claims of clinical, special-education, accreditation, or high-stakes assessment validity.
- Storage or processing of names, email addresses, school identifiers, disability information, or production student records.
- A required live OpenAI/paid API dependency on the public judge path.
- Reimplementation of CausalGate or reuse of its codebase.

## 5. Journeys

### J1 — Primary learner journey

1. Learner opens judge mode and sees a short privacy notice plus seeded examples.
2. Learner loads a problem and its typed solution steps, then selects **Check my reasoning**.
3. The app parses every step and deterministically compares consecutive solution sets.
4. The first invalid transition is highlighted; later steps are marked “not evaluated yet.”
5. The app shows one minimal hint and a concise misconception explanation, labeled as GPT-5.6-assisted or deterministic fallback.
6. Learner edits the invalid step and checks again.
7. After the original reasoning is valid through a correct solved form, the app presents one structurally equivalent transfer problem.
8. Learner submits a solution; deterministic validation records mastered or needs-practice.

### J2 — Teacher/judge evidence journey

1. Teacher/judge opens **Evidence** for the current session.
2. The view shows the synthetic problem, ordered steps, first-invalid transition, misconception category, hint provenance, correction attempts, transfer problem, and deterministic mastery result.
3. Teacher/judge returns to the learner view without changing any evidence.

### J3 — Clean valid solution

If every submitted transition is valid and the final line isolates `x` with the correct value, the app confirms the reasoning, skips misconception remediation, and offers a transfer problem. It does not invent an error.

If the starting equation has no solution (for example, it simplifies to a contradiction) or all real numbers are solutions (an identity), the app reports that solution-set classification as a valid terminal boundary outcome. It explains that there is no unique value of `x`, records the outcome in evidence, and does not offer transfer or award mastery.

### J4 — Parse or unsupported-input failure

If any line is empty, malformed, nonlinear, contains another variable, or uses unsupported syntax, the app identifies the first unparseable line and gives a correction example for syntax only. It does not label a mathematical misconception or call a live model.

### J5 — Pedagogy service failure

If live GPT-5.6-assisted pedagogy is configured but times out or returns invalid output, deterministic mathematical analysis remains available and the UI uses a reviewed fallback hint, marks its provenance, and offers retry. Learner work is not lost. The learner can then correct the step, complete transfer, inspect the matching teacher evidence, and reset the session without the failed provider recovering.

### J6 — Empty, loading, reset, and repeated attempt

- Empty: analysis is disabled until a problem and at least two nonempty steps exist.
- Loading: one visible, non-blocking progress state prevents duplicate analysis submission.
- Repeated attempt: prior attempts remain visible in the current session evidence.
- Reset: a confirmation clears the current ephemeral session and restores seeded-example selection.

## 6. Functional requirements

| ID | Requirement |
|---|---|
| FR-001 | The system shall let a learner load a seeded synthetic example or enter a problem plus an ordered list of at least two typed equation steps within the supported expression subset. |
| FR-002 | The system shall parse and validate the problem and each step, returning a line-specific unsupported or syntax error without classifying it as a misconception. |
| FR-003 | The system shall deterministically compare each consecutive pair in order and identify only the earliest transition whose equations do not have the same solution set. |
| FR-004 | The system shall distinguish an invalid transformation, a uniquely solved valid solution, and valid terminal `no solution` or `all real numbers` boundary outcomes; it shall not evaluate steps after the first invalid transition until it is repaired. |
| FR-005 | For an invalid transformation, the system shall display a supported misconception category, one minimal answer-withholding hint, a concise explanation, and the pedagogy provenance. |
| FR-006 | The learner shall be able to edit the invalid and subsequent steps, rerun analysis, and retain an ordered attempt history in the current session. |
| FR-007 | After a valid original solution, the system shall present one structurally equivalent transfer problem with changed coefficients and deterministically validate the learner’s submitted solved value. |
| FR-008 | The system shall compute mastery as `mastered` only when the original solution is valid and the transfer answer is correct; otherwise it shall show `needs practice` or `in progress`. |
| FR-009 | A read-only evidence view shall show the current session’s problem, submitted steps, diagnosis, hint and provenance, attempt sequence, transfer problem/response, and mastery result. |
| FR-010 | Public judge mode shall provide at least three synthetic examples, including distribution, sign/equality, and fully valid reasoning cases, with pre-generated reviewed GPT-5.6 pedagogical assets and no runtime API key. |
| FR-011 | The UI shall provide explicit empty, loading, success, unsupported-input, pedagogy-fallback, and reset states without discarding valid current-session work on recoverable failure. |
| FR-012 | A judge-facing provenance view shall state that the user created and invoked the Greenfield Software Factory skill using GPT-5.6 Sol ultra reasoning, describe Codex’s factory role, and link this run’s local/public Build Week evidence when available. |

## 7. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-001 | For identical supported input and validator version, mathematical diagnosis and mastery outcomes shall be identical across repeated runs. |
| NFR-002 | On reference judge-mode data, local analysis shall complete within 1 second at the 95th percentile and initial usable UI shall render within 3 seconds on a current desktop browser under a normal broadband connection. |
| NFR-003 | The learner and evidence workflows shall meet WCAG 2.2 AA for keyboard access, visible focus, semantic labels, status announcements, contrast, and non-color-only error identification. |
| NFR-004 | Judge mode shall run without an OpenAI key or paid service and shall expose no secret values to the browser or persisted evidence. |
| NFR-005 | The system shall not intentionally collect real student identifiers; raw equations and answers shall remain ephemeral and shall not appear in analytics or application logs. |
| NFR-006 | Recoverable pedagogy failure shall not prevent deterministic diagnosis, correction, transfer validation, reset, or evidence inspection. |
| NFR-007 | The supported parser and validator shall have automated positive, negative, boundary, and regression tests covering every misconception fixture and acceptance rule. |
| NFR-008 | The responsive learner and evidence flows shall remain usable without horizontal scrolling at 360×800 and 1440×900 viewports in current Chromium. |
| NFR-009 | If optional live pedagogy is enabled, it shall accept only the closed structured evidence schema with a serialized payload no larger than 4 KiB; allow at most one in-flight request per session, five requests per session per minute, and thirty requests per coarse network source per minute; time out at 10 seconds; deduplicate the same request identifier for five minutes; and stop provider calls when either a configured daily request quota or USD spend ceiling is reached. Both ceilings default to zero/disabled, and judge mode never enables live calls. |
| NFR-010 | Pedagogy output shall conform to a closed, length-bounded plain-text schema and be rendered with framework escaping; active content, links, control characters, unknown fields, and out-of-enum categories shall be rejected in favor of a reviewed fallback. |
| NFR-011 | MVP learner/evidence state shall be client-local and shall not use a server session, state-bearing cookie, server mutation/reset endpoint, process-global learner object, shareable-URL identifier, or referrer identifier. Introducing server-bound state is outside MVP scope and requires a new security decision covering host-only `Secure`, `HttpOnly`, appropriate `SameSite` cookies, Origin/Fetch Metadata and CSRF validation, non-GET mutations, restrictive non-wildcard credentialed CORS, disclosure, and cross-origin negative tests before release. |
| NFR-012 | Before parsing or symbolic expansion, one analysis shall be limited to one problem plus at most 12 submitted steps, 256 characters and 128 lexical tokens per equation, 3,072 equation characters total, 12 digits per numeric literal, parenthesis depth 8, 96 parsed/normalized nodes per equation, and 768 nodes total. Analysis shall cancel and return `input too complex` after 500 ms wall time or 20,000 instrumented normalization/equivalence work units, whichever occurs first. |
| NFR-013 | Every shipped seeded or fallback hint/explanation shall have a versioned semantic content record tying the deterministic first-invalid transition to an expected misconception category and governing algebra rule, and shall pass a recorded project-owner pedagogy review for mathematical truth, relevance to that transition, answer restraint, clarity, and absence of contradictory guidance. |

## 8. Business rules and invariants

1. **BR-001 — Supported equation:** both sides must parse to expressions linear in `x`; constants may be integers or rationals, and division may only be by a known nonzero constant. Unsupported input is not a wrong math step.
2. **BR-002 — Valid transition:** two consecutive equations are validly related when their solution sets over the real numbers are equal within the supported domain. Textual similarity is irrelevant.
3. **BR-003 — First error only:** analysis stops at the first invalid or unparseable transition. Later steps cannot affect the reported first error.
4. **BR-004 — Correct completion:** an original solution is complete only when all transitions are valid and the final supported equation uniquely isolates `x` at the original equation’s solution.
5. **BR-005 — Hint restraint:** the remediation hint must not state the original problem’s final numeric value or supply all remaining algebra steps. It may name the governing rule and ask one targeted question.
6. **BR-006 — Model boundary:** an LLM may classify/explain from structured validator evidence and author a transfer candidate, but it may not decide transition validity, final-answer correctness, or mastery.
7. **BR-007 — Transfer equivalence:** a transfer problem must exercise the same diagnosed misconception category (or the same equation skill for a clean solution), change at least one coefficient, remain inside the supported subset, and be machine-validated before display.
8. **BR-008 — Mastery:** `mastered` requires a valid original solution plus a correct transfer response. Viewing a hint or correcting the original alone is insufficient.
9. **BR-009 — Provenance:** pedagogy is labeled `GPT-5.6-assisted`, `reviewed judge fixture`, or `deterministic fallback`; the UI must not imply a live model call when none occurred.
10. **BR-010 — Session isolation:** evidence contains only the active ephemeral browser context. MVP state is client-local and is not stored server-side, process-global, in cookies, encoded in shareable URLs, or sent in referrers. Every fresh browser context begins empty and cannot read, mutate, reset, or guess another context’s state. Confirmed in-app reset clears the active context immediately; full page reload/navigation and tab or browser-context closure also end that context’s in-memory state. A service restart alone cannot clear an already-open browser context and is not an MVP client-state clearing event; restart clearing is tested only if a future design introduces server-held state.
11. **BR-011 — Non-unique boundary outcomes:** a supported starting equation with an empty solution set is labeled `no solution`; one whose solution set is all real numbers is labeled `all real numbers`. Equivalent intermediate transitions remain valid, but either starting class terminates without transfer and without `mastered`.
12. **BR-012 — Safe pedagogy output:** accepted output has exactly `category`, `hint`, and `explanation`; category is from the documented enum, hint is at most 280 Unicode characters, and explanation is at most 600. HTML, Markdown links/images, URLs, ASCII control characters other than line breaks, or extra fields invalidate the whole response. Accepted strings are rendered as escaped plain text, never injected HTML.
13. **BR-013 — Live pedagogy fail-closed controls:** live requests use structured validator evidence only, enforce NFR-009 before provider invocation, return generic `pedagogy unavailable` errors with bounded retry guidance, and record only request ID, limit category, timing, and status. Quota, spend, timeout, malformed, duplicate, and overload failures always fall back without affecting deterministic results.
14. **BR-014 — Minor-facing public demo:** the hosted demo requests no age or identity, sets no advertising or behavioral-tracking technology, uses no nonessential cookies, discloses unavoidable hosting/CDN metadata, and selects the shortest supported platform retention not exceeding seven days.
15. **BR-015 — Complexity rejection:** every NFR-012 limit is checked before expensive symbolic expansion where applicable. A violation identifies the first affected line (or total request), says `Input too complex—shorten this equation or solution`, preserves all editable work, makes no pedagogy call, and logs only a limit code and timing. If deterministic analysis is ever moved server-side, it must additionally allow one in-flight analysis per client context, deduplicate request identifiers for five minutes, and enforce a coarse-source limit before computation.
16. **BR-016 — Pedagogy semantic contract:** each seeded misconception fixture declares `expected_first_invalid_index`, `expected_category`, `governing_rule`, allowed teaching concepts, and forbidden contradictory concepts. The displayed category, hint, explanation, and fallback must agree with that contract and deterministic evidence; schema-valid but semantically mismatched content is rejected.

## 9. Data, retention, and privacy

| Data | Classification | Purpose | Retention | Privacy/control |
|---|---|---|---|---|
| Seeded problems, steps, hints, explanations, transfer items | Public synthetic | Judge demonstration and tests | Versioned with product | Must contain no real-person data; reviewed before release. |
| User-entered equations and attempts | Ephemeral user content; treat as potentially sensitive despite intended synthetic use | Current learning flow | In-memory for the active browser context only; cleared by confirmed in-app reset, full page reload/navigation, or tab/browser-context closure; never intentionally persisted. A service restart alone does not erase an already-open context. | UI warns not to enter personal/student information; exclude from logs and analytics. |
| Diagnosis, misconception, mastery state | Ephemeral derived educational data | Feedback and current evidence view | Same lifetime as current session | Not an official grade; not shared across sessions. |
| Build provenance and factory artifacts | Public project metadata | Build Week evidence and reproducibility | Repository/project lifetime | Must exclude credentials, private prompts, and unrelated project data. |
| Operational logs | Internal operational metadata | Health and error diagnosis | Maximum 7 days in a hosted demo, configurable shorter | Record request ID, timing, status, and error code only; no raw equations, answers, hints, or identifiers. |
| Hosting/CDN access metadata (for example IP address, user agent, timestamp, requested path, and referrer) | Infrastructure metadata that may relate to a minor | Delivery, abuse prevention, and reliability where the host unavoidably collects it | Shortest platform-supported duration, never more than 7 days for the demo | Disclose collection; suppress or truncate fields where supported; exclude query strings/session identifiers; disable advertising, behavioral tracking, third-party analytics, and nonessential cookies. |

The product is a demonstration, not a FERPA/COPPA student-record service. The public notice is written for learners and guardians, states that the demo is synthetic-only, identifies unavoidable hosting metadata and its retention, and directs users not to enter personal information. A future deployment using real learners, accounts, or school records requires a separate privacy, consent, retention, access-control, and legal review.

Mandatory release evidence uses automated synthetic browser actions, traces, screenshots, and independent specialist review only; it collects no participant recording, voice, face, name, familiarity profile, or other personal data. Any future human usability study is optional post-MVP work requiring separate authority and privacy/consent controls.

## 10. Assumptions and dependencies

### Assumptions

- The working name can change without altering product behavior.
- MVP users can type algebra and understand equation notation.
- Synthetic seeded examples are sufficient for public judging and demonstration.
- Current-session teacher evidence is valuable without accounts or longitudinal analytics.
- GPT-5.6-assisted copy can be pre-generated and reviewed for judge mode; an optional live integration may exist only if it preserves the no-key path.
- The skill-creation and GPT-5.6 Sol ultra provenance is user-supplied Build Week evidence and will be supported by this run’s dated artifacts.

### Dependencies

- A deterministic symbolic algebra/parser capability suitable for the documented subset.
- A current Chromium-compatible web runtime.
- Bundled synthetic fixtures and reviewed GPT-5.6-assisted pedagogical content.
- Optional live GPT-5.6 configuration, if implemented, must be server-side, nonessential, and subject to NFR-009, NFR-010, BR-012, and BR-013.
- Codex and the Greenfield Software Factory process for implementation and evidence generation.

## 11. Risks

| ID | Risk | Likelihood / impact | Mitigation and verification |
|---|---|---|---|
| RISK-001 | Symbolic equivalence accepts an invalid step or rejects a valid one. | Medium / High | Constrain grammar; use solution-set semantics; regression fixtures for identities, no-solution/all-real edge cases, sign, distribution, and division. Verify through AC-002–AC-005, AC-018, and AC-023. |
| RISK-002 | A generated hint reveals the answer, teaches the wrong rule, or injects active content. | Medium / High | Pass structured evidence only; enforce the closed plain-text schema, golden semantic contracts, recorded pedagogy review, escaping, content/length policy, reviewed fixtures, and fallback. Verify AC-006, AC-007, AC-015, AC-027, and AC-031. |
| RISK-003 | Transfer problem is not equivalent or has an invalid/ambiguous solution. | Medium / High | Machine-validate structure and unique solution before display; deterministic seed fixtures. Verify AC-010 and AC-011. |
| RISK-004 | Judge demo fails because an API key, quota, or network service is unavailable. | Low / High | Judge mode uses bundled pedagogy and local deterministic validation. Verify AC-014 and AC-015 from a clean environment with no key. |
| RISK-005 | Users enter real student data or a host retains minor-related access metadata. | Medium / Medium | Guardian-readable synthetic-only notice; no identifiers requested; memory-only content; minimized/disclosed host logs; no advertising or behavioral tracking. Verify AC-017 and AC-024. |
| RISK-006 | “Teacher view” implies secure multi-user records or leaks state across sessions despite no authentication. | Medium / Medium | Label it current-session evidence; use client-local or high-entropy session-bound state; prohibit URL/process-global state; run two-context negative tests. Verify AC-012, AC-013, and AC-025. |
| RISK-007 | LLM output becomes the hidden correctness oracle. | Low / High | Enforce BR-006 in contracts and tests; mastery and validity contain deterministic provenance. Verify AC-004, AC-011, and AC-018. |
| RISK-008 | Second submission is judged as overlapping CausalGate. | Low / High | Maintain separate Education objective, repository, code, UX, data, and evidence; explicitly document boundary. Verify AC-020. |
| RISK-009 | Build Week provenance overstates how tools were used. | Low / High | Use dated factory artifacts, test evidence, and factual user-provided mode statement; distinguish authored fixtures from live calls. Verify AC-019. |
| RISK-010 | An optional live pedagogy endpoint is abused or exceeds provider quota/spend. | Medium / High | Default live mode and budget to off; enforce payload, rate, concurrency, timeout, deduplication, daily quota, and spend circuit breakers with metadata-only logs. Verify AC-026. |
| RISK-011 | Adversarially large or complex algebra input exhausts browser or server CPU/memory. | Medium / High | Enforce NFR-012 before expansion, instrument bounded work/cancellation, preserve editable work, and prohibit pedagogy on rejection. Verify AC-028. |

## 12. Open decisions (non-blocking for MVP)

- Final public product name and visual identity; retain the working name until availability and submission fit are reviewed.
- Whether an optional live GPT-5.6 server-configured mode is worth including; if included it must satisfy NFR-009/NFR-010, while judge mode remains the no-key acceptance baseline.
- Exact hosted-demo retention below the seven-day log ceiling; default to the shortest platform-supported period.
- Whether the public evidence view is a route or an in-page panel; permissions and content remain unchanged.

## 13. Acceptance criteria and verification

| ID | Linked requirements | Observable criterion | Verification method |
|---|---|---|---|
| AC-001 | FR-001, FR-010 | From a fresh judge session, a learner can load a fixture manifest containing at least one distribution-error case, one sign/equality-preservation case, and one fully valid case; each invalid case has reviewed GPT-5.6-assisted hint/explanation assets, and steps can be added, edited, reordered, and removed without a network model call. | Fixture-manifest contract assertion for exact required case tags/assets plus browser test with model-network interception. |
| AC-002 | FR-002, NFR-007 | For malformed, empty, nonlinear, second-variable, and zero-denominator fixtures, analysis identifies the earliest affected line with an actionable syntax/unsupported message and no misconception label. | Parameterized parser/unit tests and UI assertions. |
| AC-003 | FR-003, FR-004, NFR-001 | Given a fixture with two invalid transitions, the app reports the earlier transition on every one of ten repeated runs and marks later steps not evaluated. | Deterministic unit/integration repeat test and UI test. |
| AC-004 | FR-003, NFR-001 | For supported equivalent transformations expressed in different forms, the validator reports them valid based on equal solution sets, with no model call. | Symbolic equivalence unit tests with model adapter disabled. |
| AC-005 | FR-004 | A fully valid solution ending in the correct isolated value is labeled valid and offers transfer; no false misconception appears. | Integration test and browser happy-path test. |
| AC-006 | FR-005, NFR-013 | Each seeded invalid example displays one category, one hint, one explanation, and an accurate provenance label tied to the reported transition and its versioned governing-rule contract. | Fixture semantic-contract test, recorded pedagogy-review manifest audit, and browser content assertion. |
| AC-007 | FR-005, NFR-007, NFR-010 | Automated checks reject pedagogical output that contains the original final numeric answer, enumerates all remaining solution steps, violates the closed schema/length/enum rules, or contains active content, then select the reviewed fallback. | Unit tests for output policy, answer leakage, schema violations, and adversarial content. |
| AC-008 | FR-006 | After an invalid step is edited to a valid transformation and rechecked, the earlier diagnosis remains in ordered attempt history and current analysis advances. | Browser journey and state reducer/integration test. |
| AC-009 | FR-006, FR-011, NFR-006 | A simulated recoverable analysis or pedagogy failure preserves entered steps and enables one retry without duplicating the attempt. | Fault-injection integration and browser test. |
| AC-010 | FR-007 | Transfer is unavailable before a valid original solution; after correction it presents a different supported equation whose tagged skill/category matches the original and whose unique solution is validator-confirmed. | Generator/fixture contract tests and UI state test. |
| AC-011 | FR-007, FR-008 | Correct and incorrect transfer responses produce deterministic `mastered` and `needs practice` outcomes respectively, independent of pedagogy text. | Unit and end-to-end tests with pedagogy adapter varied/disabled. |
| AC-012 | FR-009 | Evidence view shows all required current-session fields and matches the learner view’s attempt count, first-invalid index, transfer response, and mastery state. | API/state contract test and browser comparison. |
| AC-013 | FR-009 | Teacher/judge interactions cannot modify steps, diagnosis, attempts, or mastery from the evidence view. | Keyboard/mouse browser test and mutation/API negative test. |
| AC-014 | FR-010, NFR-004 | With all model/API-key environment variables absent and outbound model requests blocked, all three seeded judge journeys, including transfer and evidence, complete successfully. | Clean-start end-to-end test with network denial and environment audit. |
| AC-015 | FR-005, FR-010, NFR-006 | When the live pedagogy adapter times out or returns invalid data, deterministic diagnosis completes, a labeled reviewed fallback appears, and retry is offered. | Fault-injection integration and browser test. |
| AC-016 | FR-011 | Empty, loading, success, unsupported, fallback, and reset-confirmation states are each reachable and render the specified action or recovery path. | Component state matrix plus browser journey screenshots. |
| AC-017 | NFR-004, NFR-005 | A synthetic marker string entered as an equation is absent from captured application/host logs, analytics/network telemetry, query strings, referrers, and persisted storage; reset removes it from current evidence. | Automated application log/network/storage inspection, hosted-log field audit, and reset browser test. |
| AC-018 | NFR-002, NFR-007 | The full parser/validator suite covers all supported operators, misconception fixtures, and solution-set boundary cases; reference analysis p95 is ≤1 second over 100 local runs. | Coverage mapping plus benchmark artifact. |
| AC-019 | FR-012 | The judge-facing provenance view factually names Codex, GPT-5.6 Sol ultra reasoning, the user-created/invoked Greenfield Software Factory skill, and links available dated factory evidence without claiming every interaction was a live API call. | Content test plus manual evidence-link audit. |
| AC-020 | FR-012 | Repository and submission audit finds no CausalGate source import, copied product data, or agent-governance workflow; the Education goal and workflow are independently documented. | Repository search, dependency audit, and manual submission review. |
| AC-021 | NFR-003, NFR-008 | At 360×800 and 1440×900, primary and evidence journeys have no horizontal page scroll; all actions work by keyboard, focus is visible, errors/statuses are programmatically announced, and automated accessibility scan has no serious/critical violations. | Playwright viewport/keyboard tests, screenshots, and automated accessibility scan. |
| AC-022 | NFR-002 | On the reference hosted build, the initial learner UI becomes usable within 3 seconds in three cold-cache runs under a documented normal-broadband profile. | Browser performance trace with median and worst-run evidence. |
| AC-023 | FR-004, NFR-007 | A no-solution starting fixture and an all-real-numbers starting fixture each reach the correct labeled terminal outcome; valid equivalence steps are accepted, evidence records the solution-set class, and transfer/mastery controls remain unavailable. | Parameterized validator/integration tests plus browser assertions for both boundary classes. |
| AC-024 | NFR-005 | Hosted judge mode requests no name, age, or school data; sets no advertising/behavioral-tracking or nonessential cookie; makes no undisclosed third-party request; shows the minor-facing metadata notice; and configures host/CDN retention to the shortest supported value no greater than seven days. | Hosted configuration audit, cookie/storage inventory, network capture, and privacy-notice content test. |
| AC-025 | NFR-011, FR-009 | Two isolated browser contexts each begin empty; context B cannot read, mutate, reset, or discover context A’s evidence through UI navigation, guessed route/API access, URL/referrer inspection, or context A reset. Confirmed reset clears only its active context; full reload/navigation and context closure return that context to empty. A service restart without reload leaves already-open client memory unchanged and is not asserted as a clearing mechanism; restart clearing is tested only if server-held state is introduced later. | Two-context Playwright negative suite covering initial emptiness, isolation, reset, reload/navigation, closure/reopen, URL/referrer inspection, and an explicit no-server-state assertion. |
| AC-026 | NFR-009, NFR-006 | With optional live pedagogy enabled in a synthetic stub environment, oversized, malformed, burst, concurrent, duplicate, timed-out, quota-exhausted, and spend-ceiling requests cause no excess provider invocation, return a generic fallback/retry state, preserve deterministic results, and emit metadata-only limit events; zero/default ceilings make no provider call. | Contract and integration tests with counted provider stub, fake clock, budget ledger, concurrency barrier, and log capture. |
| AC-027 | NFR-010, FR-005 | Pedagogy payloads containing HTML/script, Markdown links/images, URLs, control characters, extra fields, invalid category, or overlength text are rejected wholesale; the reviewed fallback renders as escaped plain text and no active element or navigation request is created. | Adversarial unit tests plus DOM/network browser assertions. |
| AC-028 | NFR-012, NFR-007 | For step count, per-line/total characters, tokens, numeric digits, nesting depth, per-line/total nodes, wall time, and work units, fixtures immediately below the limit are analyzed and fixtures immediately above it are rejected before expansion with the specified line/total `input too complex` state. Deeply nested, huge-coefficient, many-step, and forced-budget fixtures do not call pedagogy, emit raw input, lose edits, or exceed the bounded cancellation tolerance. | Parameterized parser/validator boundary tests with instrumented work counter and fake/monotonic clock, plus browser recovery and log/network assertions. |
| AC-029 | NFR-011 | Judge-mode network/storage inspection finds no server session or state cookie, no learner-state request/response, and no server mutation/reset endpoint; a cross-origin form/fetch cannot change or clear another context’s local evidence, and credentialed wildcard CORS is absent. | Two-origin browser negative test, cookie/storage inventory, route/API inventory, and network capture. |
| AC-030 | FR-001, FR-003, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010 | From a fresh browser context with model traffic blocked, a reproducible visible-UI script loads the seeded distribution case and completes diagnosis review, hinted correction, correct transfer response, and opening the matching evidence view within 180 seconds from first usable UI to evidence render, without direct state/API injection. An independent UI/UX specialist reviewing the same trace confirms that the required actions and status transitions are visible, ordered, labeled, and require no undocumented instruction. | Playwright wall-clock assertion plus synthetic trace/video/screenshots and a schema-valid independent UI/UX review report. Evidence contains synthetic fixtures and tool timestamps only—no external participants, recordings of people, or personal data. |
| AC-031 | FR-005, NFR-013 | For every shipped invalid fixture and deterministic fallback, the category and governing rule exactly match the golden semantic contract for the deterministic first-invalid transition, forbidden contradictory concepts are absent, and the recorded pedagogy rubric has no failed item. A deliberately swapped-rule fixture fails the contract test. | Golden contract suite plus versioned project-owner pedagogy-review checklist and negative mutation fixture. |
| AC-032 | NFR-006, FR-006, FR-007, FR-008, FR-009, FR-011 | With pedagogy timeout injected before the first hint, the fallback appears; the learner corrects the invalid step, completes a correct transfer, opens evidence that records the fallback and mastery, confirms reset, and returns to empty seeded-example selection—all while the provider remains unavailable and without losing or duplicating attempts. | Full browser end-to-end fault-injection journey with provider stub held unavailable through completion and post-reset state assertions. |

## 14. Traceability audit

| Requirement | Acceptance coverage | Principal risk coverage |
|---|---|---|
| FR-001 | AC-001, AC-030 | RISK-004 |
| FR-002 | AC-002 | RISK-001 |
| FR-003 | AC-003, AC-004, AC-030 | RISK-001, RISK-007 |
| FR-004 | AC-003, AC-005, AC-023 | RISK-001 |
| FR-005 | AC-006, AC-007, AC-015, AC-027, AC-030, AC-031 | RISK-002, RISK-007 |
| FR-006 | AC-008, AC-009, AC-030, AC-032 | RISK-002 |
| FR-007 | AC-010, AC-011, AC-030, AC-032 | RISK-003 |
| FR-008 | AC-011, AC-030, AC-032 | RISK-003, RISK-007 |
| FR-009 | AC-012, AC-013, AC-025, AC-030, AC-032 | RISK-006 |
| FR-010 | AC-001, AC-014, AC-015, AC-030 | RISK-004 |
| FR-011 | AC-009, AC-016, AC-032 | RISK-004 |
| FR-012 | AC-019, AC-020 | RISK-008, RISK-009 |
| NFR-001 | AC-003, AC-004 | RISK-001, RISK-007 |
| NFR-002 | AC-018, AC-022 | RISK-004 |
| NFR-003 | AC-021 | RISK-006 |
| NFR-004 | AC-014, AC-017 | RISK-004, RISK-005 |
| NFR-005 | AC-017, AC-024 | RISK-005 |
| NFR-006 | AC-009, AC-015, AC-026, AC-032 | RISK-002, RISK-004 |
| NFR-007 | AC-002, AC-007, AC-018, AC-023, AC-028 | RISK-001, RISK-002, RISK-003, RISK-011 |
| NFR-008 | AC-021 | RISK-006 |
| NFR-009 | AC-026 | RISK-004, RISK-010 |
| NFR-010 | AC-007, AC-027 | RISK-002 |
| NFR-011 | AC-025, AC-029 | RISK-006 |
| NFR-012 | AC-028 | RISK-011 |
| NFR-013 | AC-006, AC-031 | RISK-002 |

All functional and non-functional requirements have at least one measurable acceptance criterion. All acceptance criteria name a verification method that can run against synthetic data without a production system, real student data, or a paid runtime API.
