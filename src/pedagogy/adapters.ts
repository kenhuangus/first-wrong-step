import {
  canonicalizeReviewedValue,
  getFixture,
  reviewRecords,
  reviewedCases,
  reviewedContentPayload,
  reviewedEvidencePayload,
  type ReviewedCase,
} from "../content/pedagogy-assets";
import type {
  PedagogyAdapter,
  PedagogyEvidence,
  PedagogyResult,
} from "../contracts/pedagogy";
import { analyze } from "../domain/analyze";
import { validatePedagogy, type PolicyContext } from "./policy";

/** Internal request metadata; it carries no raw learner work. */
export type SafePedagogyEvidence = PedagogyEvidence &
  Readonly<{ solutionAnswer?: string }>;

type ReviewedContext = Readonly<{
  reviewed: ReviewedCase;
  evidence: PedagogyEvidence;
  policy: PolicyContext;
}>;

function deterministicAnswer(fixtureId: string): string | undefined {
  const fixture = getFixture(fixtureId);
  if (!fixture) return undefined;
  const result = analyze({ problem: fixture.problem, steps: fixture.steps });
  return "solutionSet" in result && result.solutionSet.kind === "unique"
    ? result.solutionSet.value
    : undefined;
}

async function sha256(value: unknown): Promise<`sha256:${string}`> {
  const bytes = new TextEncoder().encode(canonicalizeReviewedValue(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

async function hasPassingReview(reviewed: ReviewedCase): Promise<boolean> {
  const record = reviewRecords.get(reviewed.fixtureId);
  const fixture = getFixture(reviewed.fixtureId);
  return Boolean(
    record &&
    fixture &&
    record.fixtureId === reviewed.fixtureId &&
    record.pedagogyAssetId === reviewed.pedagogyAssetId &&
    Object.values(record.rubric).every(Boolean) &&
    record.evidenceDigest ===
      (await sha256(reviewedEvidencePayload(fixture, reviewed))) &&
    record.contentDigest === (await sha256(reviewedContentPayload(reviewed))),
  );
}

function contextFor(
  supplied: SafePedagogyEvidence,
  requireExactIdentity: boolean,
): ReviewedContext | undefined {
  const reviewed = supplied.fixtureId
    ? reviewedCases.get(supplied.fixtureId)
    : [...reviewedCases.values()].find(
        (candidate) =>
          candidate.expectedCategory === supplied.category &&
          candidate.governingRule === supplied.governingRule &&
          candidate.expectedFirstInvalidIndex >= 0,
      );
  if (!reviewed) return undefined;

  const exactEvidence = {
    fixtureId: reviewed.fixtureId,
    category: reviewed.expectedCategory,
    governingRule: reviewed.governingRule,
    firstInvalidIndex: reviewed.expectedFirstInvalidIndex,
  };
  const answer = deterministicAnswer(reviewed.fixtureId);
  const evidenceMismatch =
    supplied.category !== exactEvidence.category ||
    supplied.governingRule !== exactEvidence.governingRule ||
    supplied.firstInvalidIndex !== exactEvidence.firstInvalidIndex;
  if (
    (requireExactIdentity &&
      (supplied.fixtureId !== reviewed.fixtureId || evidenceMismatch)) ||
    (requireExactIdentity &&
      supplied.solutionAnswer !== undefined &&
      supplied.solutionAnswer !== answer)
  )
    return undefined;

  // A non-fixture request may reuse only a category/rule-matched reviewed
  // fallback. Its current deterministic answer is still enforced.
  if (!supplied.fixtureId) {
    return {
      reviewed,
      evidence: supplied,
      policy: {
        forbiddenAnswers: [supplied.solutionAnswer ?? answer].filter(
          (value): value is string => value !== undefined,
        ),
        allowedConcepts: reviewed.allowedConcepts,
        forbiddenConcepts: reviewed.forbiddenConcepts,
      },
    };
  }
  return {
    reviewed,
    evidence: supplied.fixtureId ? exactEvidence : supplied,
    policy: {
      forbiddenAnswers: [supplied.solutionAnswer ?? answer].filter(
        (value): value is string => value !== undefined,
      ),
      allowedConcepts: reviewed.allowedConcepts,
      forbiddenConcepts: reviewed.forbiddenConcepts,
    },
  };
}

function fallbackContext(evidence: SafePedagogyEvidence): ReviewedContext {
  const context = contextFor(evidence, false);
  if (!context)
    throw new Error("No digest-bound reviewed fallback matches this evidence");
  return context;
}

async function reviewedFallback(
  evidence: SafePedagogyEvidence,
  suppliedContext?: ReviewedContext,
): Promise<PedagogyResult> {
  const context = suppliedContext ?? fallbackContext(evidence);
  if (!(await hasPassingReview(context.reviewed)))
    throw new Error("Reviewed fallback digest verification failed");
  const checked = validatePedagogy(
    context.reviewed.fallback,
    context.evidence,
    context.policy,
  );
  if (!checked.ok) throw new Error("Reviewed fallback failed its bound policy");
  return {
    content: checked.content,
    provenance: "deterministic fallback",
    status: "fallback",
    retryable: true,
  };
}

function classifyReviewedContent(
  candidate: unknown,
  context: ReviewedContext,
): "pedagogy" | "fallback" | undefined {
  const canonicalCandidate = canonicalizeReviewedValue(candidate);
  if (
    canonicalCandidate === canonicalizeReviewedValue(context.reviewed.pedagogy)
  )
    return "pedagogy";
  if (
    canonicalCandidate === canonicalizeReviewedValue(context.reviewed.fallback)
  )
    return "fallback";
  return undefined;
}

export class JudgeFixtureAdapter implements PedagogyAdapter {
  async getPedagogy(evidence: SafePedagogyEvidence, signal: AbortSignal) {
    if (signal.aborted)
      return {
        kind: "failure" as const,
        code: "timeout" as const,
        retryable: true,
      };
    const context = contextFor(evidence, Boolean(evidence.fixtureId));
    if (!context || !(await hasPassingReview(context.reviewed)))
      return {
        kind: "failure" as const,
        code: "invalid_output" as const,
        retryable: true,
      };
    // Edited/free-form work deliberately receives only the reviewed fallback;
    // fixture pedagogy is bound to an exact deterministic fixture identity.
    if (!evidence.fixtureId)
      return {
        kind: "content" as const,
        result: await reviewedFallback(evidence, context),
      };
    const validated = validatePedagogy(
      context.reviewed.pedagogy,
      context.evidence,
      context.policy,
    );
    if (!validated.ok)
      return {
        kind: "failure" as const,
        code: "invalid_output" as const,
        retryable: true,
      };
    return {
      kind: "content" as const,
      result: {
        content: validated.content,
        provenance: "reviewed judge fixture" as const,
        status: "ready" as const,
        retryable: false,
      },
    };
  }
}

export class DeterministicFallbackAdapter implements PedagogyAdapter {
  async getPedagogy(evidence: SafePedagogyEvidence, signal: AbortSignal) {
    if (signal.aborted)
      return {
        kind: "failure" as const,
        code: "timeout" as const,
        retryable: true,
      };
    return {
      kind: "content" as const,
      result: await reviewedFallback(evidence),
    };
  }
}

export async function requestSafePedagogy(
  adapter: PedagogyAdapter,
  evidence: SafePedagogyEvidence,
  signal: AbortSignal,
): Promise<Readonly<{ result: PedagogyResult; failureCode?: string }>> {
  const context = contextFor(evidence, Boolean(evidence.fixtureId));
  if (!context) {
    const fallback = fallbackContext(evidence);
    if (!(await hasPassingReview(fallback.reviewed)))
      throw new Error("No verified reviewed fallback is available");
    return {
      result: await reviewedFallback(evidence, fallback),
      failureCode: "invalid_output",
    };
  }
  try {
    const responsePromise = adapter.getPedagogy(evidence, signal);
    if (!(await hasPassingReview(context.reviewed)))
      throw new Error("Reviewed asset digest verification failed");
    const response = await responsePromise;
    if (response.kind === "failure")
      return {
        result: await reviewedFallback(evidence, context),
        failureCode: response.code,
      };
    const matchedAsset = classifyReviewedContent(
      response.result.content,
      context,
    );
    if (!matchedAsset || (!evidence.fixtureId && matchedAsset !== "fallback"))
      return {
        result: await reviewedFallback(evidence, context),
        failureCode: "invalid_output",
      };
    const checked = validatePedagogy(
      response.result.content,
      context.evidence,
      context.policy,
    );
    if (!checked.ok)
      return {
        result: await reviewedFallback(evidence, context),
        failureCode: "invalid_output",
      };
    return {
      result:
        matchedAsset === "pedagogy"
          ? {
              content: checked.content,
              provenance: "reviewed judge fixture",
              status: "ready",
              retryable: false,
            }
          : {
              content: checked.content,
              provenance: "deterministic fallback",
              status: "fallback",
              retryable: true,
            },
    };
  } catch {
    const context = fallbackContext(evidence);
    if (!(await hasPassingReview(context.reviewed)))
      throw new Error("No verified reviewed fallback is available");
    return {
      result: await reviewedFallback(evidence, context),
      failureCode: "unavailable",
    };
  }
}
