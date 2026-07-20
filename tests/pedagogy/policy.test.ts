import { describe, expect, it } from "vitest";
import type { PedagogyEvidence } from "../../src/contracts/pedagogy";
import { validatePedagogy } from "../../src/pedagogy/policy";

const evidence: PedagogyEvidence = {
  category: "distribution",
  governingRule:
    "Multiply every term inside the parentheses by the outside factor.",
  firstInvalidIndex: 2,
};
const safe = {
  category: "distribution",
  hint: "Check whether the factor reached each term.",
  explanation: "The distributive property applies the factor to every term.",
};

describe("closed pedagogy output policy", () => {
  it("accepts concise rule-aligned plain text", () => {
    expect(validatePedagogy(safe, evidence)).toMatchObject({ ok: true });
  });

  it.each([
    ["extra key", { ...safe, answer: "x" }],
    ["invalid category", { ...safe, category: "calculus" }],
    ["mismatched category", { ...safe, category: "sign_handling" }],
    ["HTML", { ...safe, hint: "<strong>factor</strong>" }],
    ["script", { ...safe, hint: "<script>alert(1)</script> factor" }],
    ["Markdown link", { ...safe, hint: "[factor](https://bad.example)" }],
    ["Markdown image", { ...safe, hint: "![factor](bad.png)" }],
    ["Markdown reference link", { ...safe, hint: "[factor][help]" }],
    ["encoded Markdown link", { ...safe, hint: "%5Bfactor%5D%5Bhelp%5D" }],
    ["URL", { ...safe, hint: "See https://bad.example for factor help" }],
    ["FTP URL", { ...safe, hint: "See ftp://bad.example for factor help" }],
    [
      "mailto URL",
      { ...safe, hint: "Ask mailto:help@bad.example about factors" },
    ],
    ["data URL", { ...safe, hint: "Open data:text/plain,factor" }],
    [
      "JavaScript URL",
      { ...safe, hint: "Use javascript:alert(1) for factors" },
    ],
    ["file URL", { ...safe, hint: "Open file:///tmp/factor.txt" }],
    ["protocol-relative URL", { ...safe, hint: "See //bad.example/factor" }],
    ["www domain", { ...safe, hint: "See www.bad.example for factor help" }],
    ["bare domain", { ...safe, hint: "See bad.example for factor help" }],
    ["bare IPv4", { ...safe, hint: "See 192.168.10.4 for factor help" }],
    ["bare IPv6", { ...safe, hint: "See 2001:db8::1 for factor help" }],
    ["bracketed IPv6", { ...safe, hint: "See [2001:db8::1] for help" }],
    ["localhost", { ...safe, hint: "See localhost:8080 for factor help" }],
    ["host port", { ...safe, hint: "See factor-host:8443 for help" }],
    ["arbitrary scheme", { ...safe, hint: "Open tutor+hint:factor" }],
    [
      "autolink",
      { ...safe, hint: "See <https://bad.example> for factor help" },
    ],
    [
      "encoded scheme",
      { ...safe, hint: "See %68%74%74%70%73%3A%2F%2Fbad.example" },
    ],
    ["encoded domain", { ...safe, hint: "See bad%2Eexample for factor help" }],
    [
      "HTML-encoded scheme",
      { ...safe, hint: "See h&#x74;tps&#58;//bad.example" },
    ],
    ["obfuscated scheme", { ...safe, hint: "See h.t.t.p.s: //bad.example" }],
    ["obfuscated domain", { ...safe, hint: "See bad [dot] example" }],
    [
      "control-separated URL",
      { ...safe, hint: "h\u0000ttps://bad.example factor" },
    ],
    ["control", { ...safe, hint: "factor\u0000term" }],
    ["enumerated solution", { ...safe, hint: "1. distribute 2. divide" }],
    [
      "split numbered solution",
      {
        ...safe,
        hint: "1. distribute the factor",
        explanation: "2. divide both sides",
      },
    ],
    [
      "split prose solution",
      {
        ...safe,
        hint: "First distribute the factor.",
        explanation: "Then divide both sides.",
      },
    ],
    [
      "prose sequence",
      { ...safe, hint: "First distribute, next combine, finally divide." },
    ],
    [
      "bulleted sequence",
      { ...safe, hint: "- distribute the factor\n- divide both sides" },
    ],
    [
      "inline bulleted sequence",
      { ...safe, hint: "- distribute the factor; - divide both sides" },
    ],
    [
      "split step labels",
      {
        ...safe,
        hint: "Step one: distribute",
        explanation: "Step two: divide both sides",
      },
    ],
    [
      "lettered sequence",
      { ...safe, hint: "a) distribute the factor b) divide both sides" },
    ],
    [
      "ordinal sequence",
      { ...safe, hint: "Firstly distribute; secondly divide both sides." },
    ],
    [
      "unmarked sequence",
      { ...safe, hint: "Distribute the factor. Divide both sides." },
    ],
    [
      "cross-field unmarked sequence",
      {
        ...safe,
        hint: "Distribute the factor.",
        explanation: "Divide both sides.",
      },
    ],
    ["overlength hint", { ...safe, hint: `factor ${"x".repeat(181)}` }],
  ])("rejects %s", (_name, candidate) => {
    expect(validatePedagogy(candidate, evidence)).toMatchObject({ ok: false });
  });

  it("rejects generated percent and separator mutations of prohibited links", () => {
    const schemes = [
      "http",
      "https",
      "ftp",
      "mailto",
      "data",
      "javascript",
      "file",
    ];
    for (const scheme of schemes) {
      const percentEncoded = [...scheme]
        .map((character) => `%${character.charCodeAt(0).toString(16)}`)
        .join("");
      expect(
        validatePedagogy(
          { ...safe, hint: `${percentEncoded}%3a factor guidance` },
          evidence,
        ),
      ).toMatchObject({ ok: false });
      expect(
        validatePedagogy(
          { ...safe, hint: `${[...scheme].join("_")}: factor guidance` },
          evidence,
        ),
      ).toMatchObject({ ok: false });
    }
  });

  it.each([
    "Check whether the factor reached each term first.",
    "Next, inspect whether the factor reached each term.",
    "The first invalid line misses one distributed term.",
  ])("retains a concise non-enumerating misconception hint: %s", (hint) => {
    expect(validatePedagogy({ ...safe, hint }, evidence)).toMatchObject({
      ok: true,
    });
  });

  it("rejects final-answer leakage and semantic contradiction", () => {
    expect(
      validatePedagogy(
        { ...safe, hint: "The factor check gives 4." },
        evidence,
        { forbiddenAnswers: ["4"] },
      ),
    ).toMatchObject({ ok: false });
    expect(
      validatePedagogy(
        { ...safe, explanation: "Change the sign before using each factor." },
        evidence,
        { forbiddenConcepts: ["change the sign"] },
      ),
    ).toMatchObject({ ok: false });
  });

  it.each([
    "04",
    "+4",
    "4.0",
    "4.000",
    "8/2",
    "12 / 3",
    "four",
    "positive four",
  ])("rejects equivalent forbidden-answer representation %s", (answer) => {
    expect(
      validatePedagogy(
        { ...safe, hint: `The factor check gives ${answer}.` },
        evidence,
        { forbiddenAnswers: ["4"] },
      ),
    ).toMatchObject({ ok: false });
  });

  it.each(["-4", "4.1", "7/2", "fourteen"])(
    "does not confuse a different number with forbidden answer 4: %s",
    (answer) => {
      expect(
        validatePedagogy(
          { ...safe, hint: `The factor check contrasts ${answer}.` },
          evidence,
          { forbiddenAnswers: ["4"] },
        ),
      ).toMatchObject({ ok: true });
    },
  );
});
