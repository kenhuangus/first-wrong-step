import { describe, expect, it } from "vitest";
import type {
  PedagogyAdapter,
  PedagogyEvidence,
} from "../../src/contracts/pedagogy";
import { reviewedCases } from "../../src/content/pedagogy-assets";
import {
  DeterministicFallbackAdapter,
  JudgeFixtureAdapter,
  requestSafePedagogy,
} from "../../src/pedagogy/adapters";

const evidence: PedagogyEvidence = {
  fixtureId: "distribution-first-wrong-step",
  category: "distribution",
  governingRule:
    "Multiply every term inside the parentheses by the outside factor.",
  firstInvalidIndex: 2,
};

const boundEvidence = { ...evidence, solutionAnswer: "4" };

describe("safe pedagogy adapters", () => {
  it("accepts each exact reviewed pedagogy and fallback only in its bound context", async () => {
    for (const reviewed of reviewedCases.values()) {
      const exactEvidence: PedagogyEvidence = {
        fixtureId: reviewed.fixtureId,
        category: reviewed.expectedCategory,
        governingRule: reviewed.governingRule,
        firstInvalidIndex: reviewed.expectedFirstInvalidIndex,
      };
      for (const [content, status] of [
        [reviewed.pedagogy, "ready"],
        [reviewed.fallback, "fallback"],
      ] as const) {
        const adapter: PedagogyAdapter = {
          getPedagogy: () =>
            Promise.resolve({
              kind: "content" as const,
              result: {
                content,
                provenance: "GPT-5.6-assisted" as const,
                status: "ready" as const,
                retryable: false,
              },
            }),
        };
        const response = await requestSafePedagogy(
          adapter,
          exactEvidence,
          new AbortController().signal,
        );
        expect(response.failureCode).toBeUndefined();
        expect(response.result.status).toBe(status);
        expect(response.result.content).toEqual(content);
      }
    }
  });

  it("rejects every textual and structural mutation to the exact reviewed asset", async () => {
    const reviewed = reviewedCases.get("distribution-first-wrong-step")!;
    const mutations: unknown[] = [
      { ...reviewed.pedagogy, hint: `${reviewed.pedagogy.hint} ` },
      { ...reviewed.pedagogy, hint: reviewed.pedagogy.hint.toUpperCase() },
      { ...reviewed.pedagogy, hint: `${reviewed.pedagogy.hint}!` },
      { ...reviewed.pedagogy, hint: `${reviewed.pedagogy.hint}\u0000` },
      {
        ...reviewed.pedagogy,
        explanation: `${reviewed.pedagogy.explanation} 4`,
      },
      { ...reviewed.pedagogy, category: "equality_preservation" as const },
      { ...reviewed.pedagogy, extra: "field" },
      {
        category: reviewed.pedagogy.category,
        hint: reviewed.pedagogy.hint,
      },
    ];
    for (const content of mutations) {
      const adapter: PedagogyAdapter = {
        getPedagogy: () =>
          Promise.resolve({
            kind: "content" as const,
            result: {
              content: content as never,
              provenance: "GPT-5.6-assisted" as const,
              status: "ready" as const,
              retryable: false,
            },
          }),
      };
      const response = await requestSafePedagogy(
        adapter,
        evidence,
        new AbortController().signal,
      );
      expect(response.failureCode).toBe("invalid_output");
      expect(response.result.status).toBe("fallback");
      expect(response.result.content).toEqual(reviewed.fallback);
    }
  });

  it("rejects an exact reviewed asset when swapped into another bound context", async () => {
    const distribution = reviewedCases.get("distribution-first-wrong-step")!;
    const equality = reviewedCases.get("sign-equality-first-wrong-step")!;
    const adapter: PedagogyAdapter = {
      getPedagogy: () =>
        Promise.resolve({
          kind: "content" as const,
          result: {
            content: distribution.pedagogy,
            provenance: "reviewed judge fixture" as const,
            status: "ready" as const,
            retryable: false,
          },
        }),
    };
    const response = await requestSafePedagogy(
      adapter,
      {
        fixtureId: equality.fixtureId,
        category: equality.expectedCategory,
        governingRule: equality.governingRule,
        firstInvalidIndex: equality.expectedFirstInvalidIndex,
      },
      new AbortController().signal,
    );
    expect(response.failureCode).toBe("invalid_output");
    expect(response.result.content).toEqual(equality.fallback);
  });

  it("returns reviewed static fixture copy without provider configuration", async () => {
    const response = await requestSafePedagogy(
      new JudgeFixtureAdapter(),
      evidence,
      new AbortController().signal,
    );
    expect(response.failureCode).toBeUndefined();
    expect(response.result.status).toBe("ready");
    expect(response.result.provenance).toBe("reviewed judge fixture");
  });

  it("returns a labeled plain deterministic fallback", async () => {
    const response = await requestSafePedagogy(
      new DeterministicFallbackAdapter(),
      evidence,
      new AbortController().signal,
    );
    expect(response.result).toMatchObject({
      status: "fallback",
      provenance: "deterministic fallback",
      retryable: true,
    });
  });

  it.each(["timeout", "invalid_output", "unavailable"] as const)(
    "fails closed for %s",
    async (code) => {
      let calls = 0;
      const adapter: PedagogyAdapter = {
        getPedagogy() {
          calls += 1;
          return Promise.resolve({
            kind: "failure" as const,
            code,
            retryable: true,
          });
        },
      };
      const response = await requestSafePedagogy(
        adapter,
        evidence,
        new AbortController().signal,
      );
      expect(calls).toBe(1);
      expect(response.failureCode).toBe(code);
      expect(response.result.status).toBe("fallback");
    },
  );

  it("rejects active output wholesale rather than repairing fields", async () => {
    const adapter: PedagogyAdapter = {
      getPedagogy() {
        return Promise.resolve({
          kind: "content",
          result: {
            content: {
              category: "distribution",
              hint: "<a href='https://bad.example'>factor</a>",
              explanation: "The factor applies to every term.",
            },
            provenance: "GPT-5.6-assisted",
            status: "ready",
            retryable: false,
          },
        });
      },
    };
    const response = await requestSafePedagogy(
      adapter,
      evidence,
      new AbortController().signal,
    );
    expect(response.failureCode).toBe("invalid_output");
    expect(response.result.status).toBe("fallback");
    expect(response.result.content.hint).not.toContain("<a");
  });

  it("enforces deterministic answer restraint on the production request path", async () => {
    const adapter: PedagogyAdapter = {
      getPedagogy() {
        return Promise.resolve({
          kind: "content" as const,
          result: {
            content: {
              category: "distribution" as const,
              hint: "The outside factor applies to each term; x = 4.",
              explanation:
                "The distributive property preserves the solution set.",
            },
            provenance: "GPT-5.6-assisted" as const,
            status: "ready" as const,
            retryable: false,
          },
        });
      },
    };
    const response = await requestSafePedagogy(
      adapter,
      boundEvidence,
      new AbortController().signal,
    );
    expect(response.failureCode).toBe("invalid_output");
    expect(response.result.status).toBe("fallback");
    expect(
      `${response.result.content.hint} ${response.result.content.explanation}`,
    ).not.toMatch(/(^|[^0-9])4([^0-9]|$)/u);
  });

  it.each([
    ["index", { ...boundEvidence, firstInvalidIndex: 3 }],
    ["rule", { ...boundEvidence, governingRule: "Apply an unrelated rule." }],
    [
      "category",
      { ...boundEvidence, category: "equality_preservation" as const },
    ],
  ])(
    "rejects swapped fixture %s identity before serving reviewed pedagogy",
    async (_, swapped) => {
      const response = await requestSafePedagogy(
        new JudgeFixtureAdapter(),
        swapped,
        new AbortController().signal,
      );
      expect(response.failureCode).toBe("invalid_output");
      expect(response.result.status).toBe("fallback");
      expect(response.result.content.category).toBe("distribution");
    },
  );

  it("rejects fallback-string tampering through the same full policy", async () => {
    const adapter: PedagogyAdapter = {
      getPedagogy() {
        return Promise.resolve({
          kind: "content" as const,
          result: {
            content: {
              category: "distribution" as const,
              hint: "Inspect the factor at https://tampered.example.",
              explanation: "The factor applies to each term.",
            },
            provenance: "deterministic fallback" as const,
            status: "fallback" as const,
            retryable: true,
          },
        });
      },
    };
    const response = await requestSafePedagogy(
      adapter,
      boundEvidence,
      new AbortController().signal,
    );
    expect(response.failureCode).toBe("invalid_output");
    expect(response.result.content.hint).not.toContain("tampered.example");
  });

  it.each([
    [
      "bare-domain bypass",
      "Inspect the factor at tampered.example.",
      "The factor applies to each term.",
    ],
    [
      "cross-field sequence bypass",
      "First distribute the factor.",
      "Then divide both sides.",
    ],
  ])(
    "applies the full closed policy to %s",
    async (_name, hint, explanation) => {
      const adapter: PedagogyAdapter = {
        getPedagogy() {
          return Promise.resolve({
            kind: "content" as const,
            result: {
              content: {
                category: "distribution" as const,
                hint,
                explanation,
              },
              provenance: "GPT-5.6-assisted" as const,
              status: "ready" as const,
              retryable: false,
            },
          });
        },
      };
      const response = await requestSafePedagogy(
        adapter,
        boundEvidence,
        new AbortController().signal,
      );
      expect(response.failureCode).toBe("invalid_output");
      expect(response.result.status).toBe("fallback");
    },
  );
});
