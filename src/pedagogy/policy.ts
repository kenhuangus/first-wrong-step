import type { Category } from "../contracts/domain";
import type { Pedagogy, PedagogyEvidence } from "../contracts/pedagogy";

export type PolicyContext = Readonly<{
  forbiddenAnswers?: readonly string[];
  allowedConcepts?: readonly string[];
  forbiddenConcepts?: readonly string[];
}>;

export type PolicyResult =
  | Readonly<{ ok: true; content: Pedagogy }>
  | Readonly<{ ok: false; reason: string }>;

const categories = new Set<Category>([
  "distribution",
  "combining_like_terms",
  "sign_handling",
  "inverse_operation",
  "division_multiplication",
  "equality_preservation",
  "unclassified",
]);

const unsafeMarkupOrControls =
  /<[^>]*>|<\/script|\[[^\]]*\]\([^)]*\)|!\[[^\]]*\]\([^)]*\)|[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060\ufeff]/iu;

function decodeForPolicy(value: string): string {
  let decoded = value.normalize("NFKC");
  decoded = decoded.replace(
    /&#(?:x([0-9a-f]+)|(\d+));?/giu,
    (match, hex: string | undefined, decimal: string | undefined) => {
      const point = Number.parseInt(hex ?? decimal ?? "", hex ? 16 : 10);
      return Number.isFinite(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : match;
    },
  );
  decoded = decoded.replace(
    /&(colon|sol|period|commat|amp);?/giu,
    (_match, entity: string) =>
      ({ colon: ":", sol: "/", period: ".", commat: "@", amp: "&" })[
        entity.toLocaleLowerCase()
      ] ?? _match,
  );
  for (let pass = 0; pass < 3; pass += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded.toLocaleLowerCase();
}

function containsLinkRepresentation(value: string): boolean {
  const normalized = decodeForPolicy(value).replace(
    /(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\s+dot\s+)/giu,
    ".",
  );
  const scheme =
    /(?:^|[^a-z0-9+.-])(?:[a-z][a-z0-9+.-]{1,31}|h[\s._-]*t[\s._-]*t[\s._-]*p[\s._-]*s?|f[\s._-]*t[\s._-]*p|m[\s._-]*a[\s._-]*i[\s._-]*l[\s._-]*t[\s._-]*o|d[\s._-]*a[\s._-]*t[\s._-]*a|j[\s._-]*a[\s._-]*v[\s._-]*a[\s._-]*s[\s._-]*c[\s._-]*r[\s._-]*i[\s._-]*p[\s._-]*t|f[\s._-]*i[\s._-]*l[\s._-]*e)\s*:/iu;
  const protocolRelative = /(?:^|[\s<(])\/\s*\/\s*[a-z0-9]/iu;
  const markdownOrAutolink =
    /!?\[[^\]]*\]\s*(?:\([^)]*\)|\[[^\]]*\])|<[^>]*>/iu;
  const bareDomain =
    /(?:^|[^a-z0-9-])(?:www\s*\.\s*)?(?:[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\s*\.\s*)+[a-z]{2,63}(?=$|[^a-z0-9-])/iu;
  const ipv4 = /(?:^|[^0-9])(?:\d{1,3}\s*\.\s*){3}\d{1,3}(?=$|[^0-9])/u;
  const ipv6 =
    /(?:^|[^0-9a-f])\[?(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}\]?(?=$|[^0-9a-f])/iu;
  const localOrHostPort =
    /(?:^|[^a-z0-9.-])(?:localhost|[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?)\s*:\s*\d{1,5}(?=$|[^0-9])/iu;
  return (
    markdownOrAutolink.test(normalized) ||
    scheme.test(normalized) ||
    protocolRelative.test(normalized) ||
    bareDomain.test(normalized) ||
    ipv4.test(normalized) ||
    ipv6.test(normalized) ||
    localOrHostPort.test(normalized)
  );
}

function enumeratesSolutionSequence(value: string): boolean {
  const normalized = decodeForPolicy(value);
  const marker =
    /(?:^|[\s,;:])(?:first(?:ly)?|second(?:ly)?|third(?:ly)?|then|next|after(?:ward)?|subsequently|finally|lastly)(?=$|[\s,;:.])|(?:^|[\n;])\s*[-*\u2022]\s+|(?:^|[\s\n])(?:step\s*)?(?:\d+|one|two|three|four|five|[a-z])\s*[.):\-]/giu;
  const markers = [...normalized.matchAll(marker)].length;
  const actions = [
    ...normalized.matchAll(
      /\b(?:add|adding|subtract|subtracting|multiply|multiplying|divide|dividing|distribute|distributing|combine|combining|simplify|simplifying|isolate|isolating|solve|solving|move|moving)\b/giu,
    ),
  ].length;
  return markers >= 2 || actions >= 2 || (markers >= 1 && actions >= 2);
}

type Fraction = Readonly<{ numerator: bigint; denominator: bigint }>;

function decimalFraction(value: string): Fraction | undefined {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/u.exec(value.trim());
  if (!match) return undefined;
  const decimals = match[3] ?? "";
  const denominator = 10n ** BigInt(decimals.length);
  const magnitude = BigInt(`${match[2]}${decimals}`);
  return {
    numerator: match[1] === "-" ? -magnitude : magnitude,
    denominator,
  };
}

function numericFraction(value: string): Fraction | undefined {
  const parts = value.replace(/\s/gu, "").split("/");
  if (parts.length > 2) return undefined;
  const left = decimalFraction(parts[0] ?? "");
  if (!left) return undefined;
  if (parts.length === 1) return left;
  const right = decimalFraction(parts[1] ?? "");
  if (!right || right.numerator === 0n) return undefined;
  return {
    numerator: left.numerator * right.denominator,
    denominator: left.denominator * right.numerator,
  };
}

const integerWords = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
] as const;

function revealsForbiddenAnswer(value: string, answers: readonly string[]) {
  const normalized = decodeForPolicy(value);
  const tokens = normalized.match(
    /[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:\s*\/\s*[+-]?(?:\d+(?:\.\d+)?|\.\d+))?/gu,
  );
  return answers.some((answer) => {
    const expected = numericFraction(answer);
    if (!expected) return normalized.includes(answer.toLocaleLowerCase());
    if (
      tokens?.some((token) => {
        const candidate = numericFraction(token);
        return Boolean(
          candidate &&
          candidate.numerator * expected.denominator ===
            expected.numerator * candidate.denominator,
        );
      })
    )
      return true;
    if (expected.denominator === 1n) {
      const integer = expected.numerator;
      const magnitude = integer < 0n ? -integer : integer;
      if (magnitude <= 20n) {
        const word = integerWords[Number(magnitude)];
        const sign = integer < 0n ? "negative\\s+" : "(?:positive\\s+)?";
        return new RegExp(`\\b${sign}${word}\\b`, "u").test(normalized);
      }
    }
    return false;
  });
}
const ruleTerms: Readonly<Record<Category, readonly string[]>> = {
  distribution: ["factor", "term", "distribut"],
  combining_like_terms: ["like term", "coefficient"],
  sign_handling: ["sign", "negative"],
  inverse_operation: ["inverse", "both sides", "solution set"],
  division_multiplication: ["multiply", "divide", "both sides"],
  equality_preservation: ["both sides", "balanced", "solution set", "preserve"],
  unclassified: ["solution set", "equivalent"],
};

function isPlainSafe(value: string, maxLength: number): boolean {
  return (
    value.trim().length > 0 &&
    value.length <= maxLength &&
    !unsafeMarkupOrControls.test(value) &&
    !containsLinkRepresentation(value)
  );
}

export function validatePedagogy(
  candidate: unknown,
  evidence: PedagogyEvidence,
  context: PolicyContext = {},
): PolicyResult {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    return { ok: false, reason: "output must be an object" };
  const record = candidate as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.join(",") !== "category,explanation,hint")
    return { ok: false, reason: "output has missing or extra keys" };
  if (
    typeof record.category !== "string" ||
    !categories.has(record.category as Category) ||
    record.category !== evidence.category
  )
    return {
      ok: false,
      reason: "category does not match deterministic evidence",
    };
  if (
    typeof record.hint !== "string" ||
    typeof record.explanation !== "string" ||
    !isPlainSafe(record.hint, 180) ||
    !isPlainSafe(record.explanation, 360)
  )
    return { ok: false, reason: "text violates the closed plain-text policy" };
  const joined = `${record.hint} ${record.explanation}`.toLocaleLowerCase();
  if (enumeratesSolutionSequence(`${record.hint}\n${record.explanation}`))
    return {
      ok: false,
      reason: "content enumerates a remaining solution sequence",
    };
  if (
    context.forbiddenAnswers &&
    revealsForbiddenAnswer(joined, context.forbiddenAnswers)
  )
    return { ok: false, reason: "content reveals a forbidden final answer" };
  if (
    context.forbiddenConcepts?.some((concept) =>
      joined.includes(concept.toLocaleLowerCase()),
    )
  )
    return { ok: false, reason: "content contradicts the governing rule" };
  if (
    context.allowedConcepts?.length &&
    !context.allowedConcepts.some((concept) =>
      joined.includes(concept.toLocaleLowerCase()),
    )
  )
    return { ok: false, reason: "content lacks a reviewed rule concept" };
  if (!ruleTerms[evidence.category].some((term) => joined.includes(term)))
    return { ok: false, reason: "content does not match the governing rule" };
  return {
    ok: true,
    content: {
      category: evidence.category,
      hint: record.hint,
      explanation: record.explanation,
    },
  };
}
