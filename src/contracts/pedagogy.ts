import type { Category } from "./domain";
export type Pedagogy = Readonly<{
  category: Category;
  hint: string;
  explanation: string;
}>;
export type PedagogyResult = Readonly<{
  content: Pedagogy;
  provenance:
    "GPT-5.6-assisted" | "reviewed judge fixture" | "deterministic fallback";
  status: "ready" | "fallback";
  retryable: boolean;
}>;
export type PedagogyEvidence = Readonly<{
  fixtureId?: string;
  category: Category;
  governingRule: string;
  firstInvalidIndex: number;
}>;
export interface PedagogyAdapter {
  getPedagogy(
    evidence: PedagogyEvidence,
    signal: AbortSignal,
  ): Promise<
    | Readonly<{ kind: "content"; result: PedagogyResult }>
    | Readonly<{
        kind: "failure";
        code: "timeout" | "invalid_output" | "unavailable";
        retryable: boolean;
      }>
  >;
}
