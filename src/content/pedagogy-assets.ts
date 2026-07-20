import distributionData from "./fixtures/v1/distribution-diagnosis.json";
import fullyValidData from "./fixtures/v1/fully-valid.json";
import manifestData from "./fixtures/v1/manifest.json";
import signEqualityData from "./fixtures/v1/sign-equality.json";
import reviewData from "./pedagogy-review-manifest.json";
import type { Category } from "../contracts/domain";
import type { DiagnosisFixture } from "../contracts/fixtures";
import type { Pedagogy } from "../contracts/pedagogy";

export type ReviewedCase = Readonly<{
  fixtureId: string;
  pedagogyAssetId: string;
  expectedFirstInvalidIndex: number;
  expectedCategory: Category;
  governingRule: string;
  pedagogy: Pedagogy;
  fallback: Pedagogy;
  allowedConcepts: readonly string[];
  forbiddenConcepts: readonly string[];
}>;

export type PedagogyReviewRecord = Readonly<{
  fixtureId: string;
  pedagogyAssetId: string;
  evidenceDigest: `sha256:${string}`;
  contentDigest: `sha256:${string}`;
  rubric: Readonly<{
    schemaValid: boolean;
    matchesDeterministicIndex: boolean;
    matchesDeterministicCategory: boolean;
    matchesGoverningRule: boolean;
    doesNotRevealFinalAnswer: boolean;
    doesNotEnumerateRemainingSteps: boolean;
    plainTextOnly: boolean;
    syntheticDataOnly: boolean;
  }>;
}>;

export const fixtureManifest = manifestData as Readonly<{
  schemaVersion: 1;
  version: string;
  cases: readonly ReviewedCase[];
}>;

export const pedagogyReviewManifest = reviewData as Readonly<{
  schemaVersion: 2;
  reviewVersion: string;
  provenance: string;
  reviewer: string;
  reviewedAt: string;
  assets: readonly PedagogyReviewRecord[];
}>;

export const fixtures = Object.freeze([
  distributionData,
  signEqualityData,
  fullyValidData,
] as DiagnosisFixture[]);

export const reviewedCases = new Map(
  fixtureManifest.cases.map((reviewedCase) => [
    reviewedCase.fixtureId,
    reviewedCase,
  ]),
);

export function getFixture(fixtureId: string): DiagnosisFixture | undefined {
  return fixtures.find((fixture) => fixture.id === fixtureId);
}

/** Stable JSON for review attestations: object keys sort; array order is semantic. */
export function canonicalizeReviewedValue(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map((item) => canonicalizeReviewedValue(item)).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, item]) =>
        `${JSON.stringify(key)}:${canonicalizeReviewedValue(item)}`,
    )
    .join(",")}}`;
}

export function reviewedEvidencePayload(
  fixture: DiagnosisFixture,
  reviewed: ReviewedCase,
) {
  return {
    fixtureId: fixture.id,
    problem: fixture.problem,
    steps: fixture.steps,
    expectedFirstInvalidIndex: reviewed.expectedFirstInvalidIndex,
    expectedCategory: reviewed.expectedCategory,
    governingRule: reviewed.governingRule,
  } as const;
}

export function reviewedContentPayload(reviewed: ReviewedCase) {
  return {
    fixtureId: reviewed.fixtureId,
    pedagogyAssetId: reviewed.pedagogyAssetId,
    expectedFirstInvalidIndex: reviewed.expectedFirstInvalidIndex,
    expectedCategory: reviewed.expectedCategory,
    governingRule: reviewed.governingRule,
    pedagogy: reviewed.pedagogy,
    fallback: reviewed.fallback,
    allowedConcepts: reviewed.allowedConcepts,
    forbiddenConcepts: reviewed.forbiddenConcepts,
  } as const;
}

export const reviewRecords = new Map(
  pedagogyReviewManifest.assets.map((record) => [record.fixtureId, record]),
);
