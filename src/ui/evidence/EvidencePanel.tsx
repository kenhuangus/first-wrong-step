import { EvidenceTimeline } from "./EvidenceTimeline";
import type { TeacherEvidenceSnapshot } from "./evidence-selectors";

export function EvidencePanel({
  evidence,
  onNavigate,
}: {
  evidence: TeacherEvidenceSnapshot;
  onNavigate: (destination: "learner" | "build") => void;
}) {
  return (
    <section aria-labelledby="evidence-title" data-testid="evidence-view">
      <p className="eyebrow">Teacher / judge · read-only</p>
      <h1 id="evidence-title">Current-session evidence</h1>
      <p>
        This view reflects only the learner work held in this browser document.
        It is not an account, gradebook, or shared student record.
      </p>
      <nav aria-label="Evidence destinations">
        <button type="button" onClick={() => onNavigate("learner")}>
          Return to learner
        </button>{" "}
        <button type="button" onClick={() => onNavigate("build")}>
          Open Build view
        </button>
      </nav>
      {evidence.status === "empty" ? (
        <section role="status" aria-labelledby="empty-evidence-title">
          <p className="kicker">Empty evidence</p>
          <h2 id="empty-evidence-title">No current-session work yet</h2>
          <p>Return to the learner view and choose a synthetic example.</p>
        </section>
      ) : (
        <>
          <EvidenceTimeline evidence={evidence} />
          <section aria-labelledby="submitted-work-title">
            <p className="kicker">Submitted work</p>
            <h2 id="submitted-work-title">Problem and ordered steps</h2>
            <p>
              <strong>Problem:</strong> <code>{evidence.problem}</code>
            </p>
            <ol>
              {evidence.steps.map((step, index) => (
                <li key={`${index}-${step}`}>
                  Step {index + 1}: <code>{step}</code>
                </li>
              ))}
            </ol>
          </section>
          <section aria-labelledby="diagnosis-evidence-title">
            <p className="kicker">Diagnosis and reviewed hint</p>
            <h2 id="diagnosis-evidence-title">First-invalid evidence</h2>
            {evidence.diagnosis ? (
              <dl>
                <div>
                  <dt>Attempt</dt>
                  <dd>{evidence.diagnosis.attemptId}</dd>
                </div>
                <div>
                  <dt>First invalid step</dt>
                  <dd data-testid="evidence-first-invalid">
                    {evidence.diagnosis.firstInvalidIndex}
                  </dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd data-testid="evidence-category">
                    {evidence.diagnosis.category.replaceAll("_", " ")}
                  </dd>
                </div>
                <div>
                  <dt>Governing rule</dt>
                  <dd>{evidence.diagnosis.governingRule}</dd>
                </div>
                <div>
                  <dt>Hint provenance</dt>
                  <dd data-testid="evidence-hint-provenance">
                    {evidence.hint
                      ? `${evidence.hint.result.provenance}; static reviewed content; no live model call`
                      : "Hint still in progress or unavailable"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p role="status">No invalid transition has been recorded.</p>
            )}
          </section>
          <section aria-labelledby="attempt-evidence-title">
            <p className="kicker">Immutable attempts</p>
            <h2 id="attempt-evidence-title">
              Attempt count: {evidence.attempts.length}
            </h2>
            <ol data-testid="evidence-attempts">
              {evidence.attempts.map((attempt) => (
                <li key={attempt.id}>
                  Attempt {attempt.id}:{" "}
                  {attempt.analysis.kind.replaceAll("_", " ")}
                  {attempt.repairOfAttemptId !== undefined
                    ? `; repairs attempt ${attempt.repairOfAttemptId}`
                    : ""}
                  <br />
                  Historical problem snapshot: <code>{attempt.problem}</code>
                  <br />
                  <code>{attempt.steps.join(" → ")}</code>
                </li>
              ))}
            </ol>
          </section>
          <section aria-labelledby="transfer-evidence-title">
            <p className="kicker">Transfer and mastery</p>
            <h2 id="transfer-evidence-title">Independent exact check</h2>
            {evidence.transfer ? (
              <dl>
                <div>
                  <dt>Skill family</dt>
                  <dd>{evidence.transfer.skillTag.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>Transfer problem</dt>
                  <dd>
                    <code>{evidence.transfer.equation}</code>
                  </dd>
                </div>
                <div>
                  <dt>Response</dt>
                  <dd data-testid="evidence-transfer-response">
                    {evidence.transfer.response ?? "Not submitted"}
                  </dd>
                </div>
                <div>
                  <dt>Mastery</dt>
                  <dd data-testid="evidence-mastery">
                    {evidence.transfer.mastery.replaceAll("_", " ")}
                  </dd>
                </div>
              </dl>
            ) : (
              <p role="status">
                Transfer is available only after a valid complete solution.
              </p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
