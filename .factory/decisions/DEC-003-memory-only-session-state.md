# DEC-003 — Memory-only learner and evidence state

- Status: proposed for architecture review
- Date: 2026-07-20
- Supersedes: none

## Context

The public demo has no accounts and must not imply secure longitudinal teacher records. Cross-context leakage and retention of minor-related educational content are higher risks than losing a disposable demo session on reload.

## Decision

Keep the complete learner/evidence state in one top-level browser `useReducer` for the active document lifetime. Do not use cookies, local/session storage, IndexedDB, Cache API, service workers, BroadcastChannel, URLs, server learner objects, or learner-state endpoints. Evidence receives read-only selectors. Reset atomically replaces state.

Use reducer-only panels, not a routing library or History API. Direct `/`, `/evidence`, and `/build` loads select learner, empty evidence, and build respectively. In-app panel controls preserve reducer state but leave the entry URL/history unchanged and focus the destination `<h1 tabindex="-1">`. Because the app creates no history entry, Back leaves the current document-level entry and triggers its synchronous state purge. Forward/reload exposes the destination pathname only with a fresh empty reducer, whether the browser creates a new document or restores a BFCache entry and defensively remounts it.

Treat BFCache freeze/restore as a document-lifetime boundary without changing those ordinary panel semantics. A capture-phase `pagehide` handler registered before React mount runs for persisted and non-persisted exits. It synchronously hides/inerts the root, advances a document epoch, aborts pending adapter work, clears every app-owned learner/evidence ref/cache/request/focus token, unmounts and nulls the React root, and removes the rendered subtree. Reducer dispatch alone is not sufficient. Async work compares its request token and document epoch before commit and does not retain raw learner state across awaits.

On `pageshow.persisted === true`, assert or force the purged invariant, then mount a new root with constant empty state and the initial panel derived only from the unchanged pathname. Keep the root hidden/inert until an initial layout commit verifies empty learner/evidence state; do not restore or focus a prior control. Use no `unload`/`beforeunload` assumption. Navigation HTML may use `Cache-Control: no-store` as HTTP-cache defense in depth, but cache headers are not relied upon to disable BFCache or delete browser memory.

## Consequences

Fresh contexts and BFCache restorations are isolated without authentication or identifiers. URL/history and destination-focus behavior still have one panel oracle; in-app panels are not deep-linkable and Back does not traverse panel selections. The lifecycle controller and real-browser tests add bounded complexity necessary to make the privacy claim true. The UI must explain document-level state loss. Longitudinal classrooms, sharing, and recovery are excluded; adding them requires identity, authorization, privacy, retention, and CSRF decisions.

Playwright must deliberately obtain a real current-Chromium BFCache restore from each allowed entry path and record non-sensitive `pagehide.persisted`/`pageshow.persisted` booleans. It proves no solution, step, attempt, diagnosis, hint, transfer response, mastery, prior focus target, or teacher evidence DOM/text returns. Separate cases cover forced non-BFCache navigation, pagehide during pending failure/retry, in-app panel state preservation, and sequential users of one page/history plus an isolated second context. If the environment cannot observe both persisted booleans true, that BFCache case is reported `not-run`; a reload is not equivalent evidence.

## Rejected alternatives

- Browser persistence: conflicts with explicit ephemeral lifetime and complicates reset/isolation proof.
- Server sessions/database: creates authentication, object authorization, retention, and minor-data obligations outside MVP.
- URL-encoded evidence: leaks through history/referrers and becomes guessable/shareable.
