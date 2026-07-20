import type { AnalysisResult } from "../../contracts/analysis";
export function DiagnosisPanel({
  analysis,
}: {
  analysis: AnalysisResult | null;
}) {
  if (!analysis) return null;
  if (analysis.kind === "input_error") {
    const error = analysis.lines.find(
      (line) => line.kind === "unsupported" || line.kind === "too_complex",
    );
    if (
      !error ||
      (error.kind !== "unsupported" && error.kind !== "too_complex")
    )
      return null;
    const lineLabel =
      error.lineIndex === undefined
        ? "the submission"
        : `line ${error.lineIndex + 1}`;
    return (
      <section
        className="diagnosis error-card"
        role="alert"
        aria-labelledby="diagnosis-title"
      >
        <p className="kicker">Check the input</p>
        <h2 id="diagnosis-title">We stopped at {lineLabel}</h2>
        <p>{error.message}</p>
        <p>No mathematical misconception was assigned.</p>
      </section>
    );
  }
  if (analysis.kind === "needs_repair") {
    const disposition = analysis.lines[analysis.firstInvalidIndex];
    if (!disposition || disposition.kind !== "invalid") return null;
    return (
      <section className="diagnosis" aria-labelledby="diagnosis-title">
        <p
          className="visually-hidden"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          First wrong step found. Review step {analysis.firstInvalidIndex}.
        </p>
        <p className="kicker">First wrong step found</p>
        <h2 id="diagnosis-title">Review step {analysis.firstInvalidIndex}</h2>
        <p>
          The transition into this step changes the equation’s solution set.
          Later steps are not evaluated yet.
        </p>
        <dl>
          <div>
            <dt>Category</dt>
            <dd>{disposition.evidence.category.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt>Rule to inspect</dt>
            <dd>{disposition.evidence.governingRule}</dd>
          </div>
        </dl>
      </section>
    );
  }
  if (analysis.kind === "terminal_boundary")
    return (
      <section
        className="diagnosis success-card"
        role="status"
        aria-labelledby="diagnosis-title"
      >
        <p className="kicker">Valid boundary outcome</p>
        <h2 id="diagnosis-title">
          {analysis.solutionSet.kind === "none"
            ? "No solution"
            : "All real numbers"}
        </h2>
        <p>The submitted transformations preserve this solution-set class.</p>
      </section>
    );
  return (
    <section
      className="diagnosis success-card"
      role="status"
      aria-labelledby="diagnosis-title"
    >
      <p className="kicker">Reasoning preserved</p>
      <h2 id="diagnosis-title">
        {analysis.kind === "valid_complete"
          ? "Valid complete solution"
          : "Valid so far"}
      </h2>
      <p>No false misconception was assigned.</p>
    </section>
  );
}
