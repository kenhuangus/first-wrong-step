import type { TeacherEvidenceSnapshot } from "./evidence-selectors";

export function EvidenceTimeline({
  evidence,
}: {
  evidence: TeacherEvidenceSnapshot;
}) {
  const analysisLabel = evidence.currentAnalysis
    ? evidence.currentAnalysis.kind.replaceAll("_", " ")
    : "not checked";
  const masteryLabel = evidence.transfer
    ? evidence.transfer.mastery.replaceAll("_", " ")
    : "not available";
  return (
    <section aria-labelledby="evidence-timeline-title">
      <p className="kicker">Evidence timeline</p>
      <h2 id="evidence-timeline-title">Current-session status</h2>
      <ol>
        <li>Problem: {evidence.problem ? "selected" : "not selected"}</li>
        <li>
          Analysis: {analysisLabel}; {evidence.attempts.length} immutable{" "}
          {evidence.attempts.length === 1 ? "attempt" : "attempts"}
        </li>
        <li>
          First invalid transition: {evidence.diagnosis ? "recorded" : "none"}
        </li>
        <li>Transfer mastery: {masteryLabel}</li>
      </ol>
    </section>
  );
}
