import type { PedagogyResult } from "../../contracts/pedagogy";

export function HintCard({
  hint,
  failureCode,
  retryUsed,
  onRetry,
}: {
  hint: PedagogyResult;
  failureCode?: string;
  retryUsed: boolean;
  onRetry: () => void | Promise<void>;
}) {
  const isFallback = hint.status === "fallback";
  return (
    <section
      className={isFallback ? "hint-card fallback-card" : "hint-card"}
      aria-labelledby="hint-title"
    >
      <p className="kicker">
        {isFallback ? "Reviewed fallback hint" : "Minimal hint"}
      </p>
      <h2 id="hint-title">Try one focused check</h2>
      {failureCode ? (
        <p role="alert">
          Pedagogy {failureCode.replaceAll("_", " ")}; your work is preserved.
        </p>
      ) : null}
      <p>{hint.content.hint}</p>
      <details>
        <summary>Why this check?</summary>
        <p>{hint.content.explanation}</p>
      </details>
      <p className="provenance">
        Source: {hint.provenance}. Static reviewed content; no live model call.
      </p>
      {isFallback && !retryUsed ? (
        <button type="button" onClick={() => void onRetry()}>
          Retry hint once
        </button>
      ) : null}
      {isFallback && retryUsed ? (
        <p>Retry limit reached. Continue with the reviewed fallback.</p>
      ) : null}
    </section>
  );
}
