import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalizeReviewedValue,
  fixtureManifest,
  fixtures,
  pedagogyReviewManifest,
  reviewRecords,
  reviewedCases,
  reviewedContentPayload,
  reviewedEvidencePayload,
} from "../../src/content/pedagogy-assets";
import { analyze } from "../../src/domain/analyze";
import { validatePedagogy } from "../../src/pedagogy/policy";

const digest = (value: unknown) =>
  `sha256:${createHash("sha256")
    .update(canonicalizeReviewedValue(value), "utf8")
    .digest("hex")}`;

describe("versioned reviewed pedagogy assets", () => {
  it("ships exactly the three required synthetic cases with matching semantics", () => {
    expect(fixtureManifest.version).toBe("2026-07-20.v1");
    expect(fixtures).toHaveLength(3);
    expect(fixtureManifest.cases.map((item) => item.fixtureId)).toEqual([
      "distribution-first-wrong-step",
      "sign-equality-first-wrong-step",
      "fully-valid-isolation",
    ]);

    for (const fixture of fixtures) {
      const result = analyze({
        problem: fixture.problem,
        steps: fixture.steps,
      });
      const reviewed = reviewedCases.get(fixture.id)!;
      if (fixture.expectedFirstInvalidIndex < 0) {
        expect(result.kind).toBe("valid_complete");
        continue;
      }
      expect(result.kind).toBe("needs_repair");
      if (result.kind !== "needs_repair") continue;
      expect(result.firstInvalidIndex).toBe(reviewed.expectedFirstInvalidIndex);
      const line = result.lines[result.firstInvalidIndex];
      expect(line?.kind).toBe("invalid");
      if (line?.kind !== "invalid") continue;
      expect(reviewed.expectedCategory).toBe(line.evidence.category);
      expect(reviewed.governingRule).toBe(line.evidence.governingRule);
      const policy = {
        forbiddenAnswers:
          result.solutionSet.kind === "unique"
            ? [result.solutionSet.value]
            : [],
        allowedConcepts: reviewed.allowedConcepts,
        forbiddenConcepts: reviewed.forbiddenConcepts,
      };
      const evidence = {
        fixtureId: fixture.id,
        category: line.evidence.category,
        governingRule: line.evidence.governingRule,
        firstInvalidIndex: result.firstInvalidIndex,
      };
      expect(
        validatePedagogy(reviewed.pedagogy, evidence, policy),
      ).toMatchObject({
        ok: true,
      });
      expect(
        validatePedagogy(reviewed.fallback, evidence, policy),
      ).toMatchObject({
        ok: true,
      });
    }
  });

  it("binds deterministic evidence and every shipped content byte to per-asset review", () => {
    expect(pedagogyReviewManifest.schemaVersion).toBe(2);
    for (const fixture of fixtures) {
      const reviewed = reviewedCases.get(fixture.id)!;
      const record = reviewRecords.get(fixture.id)!;
      expect(record.pedagogyAssetId).toBe(reviewed.pedagogyAssetId);
      expect(record.evidenceDigest).toBe(
        digest(reviewedEvidencePayload(fixture, reviewed)),
      );
      expect(record.contentDigest).toBe(
        digest(reviewedContentPayload(reviewed)),
      );
      expect(Object.values(record.rubric).every(Boolean)).toBe(true);
    }
    expect(pedagogyReviewManifest.provenance).toContain("GPT-5.6 Sol ultra");
    expect(pedagogyReviewManifest.provenance).toContain("No live model call");
  });

  it("invalidates the digest for pedagogy, fallback, rule, index, and category mutations", () => {
    const original = reviewedCases.get("distribution-first-wrong-step")!;
    const golden = digest(reviewedContentPayload(original));
    const mutations = [
      {
        ...original,
        pedagogy: { ...original.pedagogy, hint: `${original.pedagogy.hint}!` },
      },
      {
        ...original,
        fallback: { ...original.fallback, hint: `${original.fallback.hint}!` },
      },
      { ...original, governingRule: `${original.governingRule} ` },
      {
        ...original,
        expectedFirstInvalidIndex: original.expectedFirstInvalidIndex + 1,
      },
      { ...original, expectedCategory: "equality_preservation" as const },
    ];
    for (const mutation of mutations)
      expect(digest(reviewedContentPayload(mutation))).not.toBe(golden);
  });

  it("fails a deliberately swapped governing-rule asset", () => {
    const distribution = reviewedCases.get("distribution-first-wrong-step")!;
    const result = validatePedagogy(
      {
        category: "distribution",
        hint: "Change the sign and inspect the negative value.",
        explanation: "A sign rule controls this transformation.",
      },
      {
        fixtureId: distribution.fixtureId,
        category: distribution.expectedCategory,
        governingRule: distribution.governingRule,
        firstInvalidIndex: distribution.expectedFirstInvalidIndex,
      },
      {
        allowedConcepts: distribution.allowedConcepts,
        forbiddenConcepts: distribution.forbiddenConcepts,
      },
    );
    expect(result).toMatchObject({ ok: false });
  });
});
