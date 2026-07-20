import { useEffect, useState } from "react";
import type { TransferSession } from "../../app/transfer-use-case";
import type {
  EvidenceDiagnosis,
  HintEvidence,
} from "../evidence/evidence-selectors";

export function TransferPanel({
  transfer,
  diagnosis,
  hint,
  onSubmit,
}: {
  transfer: TransferSession;
  diagnosis: EvidenceDiagnosis | null;
  hint: HintEvidence | null;
  onSubmit: (response: string) => void;
}) {
  const [response, setResponse] = useState(transfer.response ?? "");
  useEffect(() => setResponse(transfer.response ?? ""), [transfer.problem.id]);
  return (
    <section aria-labelledby="transfer-title" data-testid="transfer-panel">
      <p className="kicker">Transfer check</p>
      <h2 id="transfer-title">Prove the skill on changed coefficients</h2>
      <p>
        Same skill family: {transfer.problem.skillTag.replaceAll("_", " ")}. The
        exact validator confirmed one unique solution before display.
      </p>
      <p>
        Solve <code>{transfer.problem.equation}</code>
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(response);
        }}
      >
        <label htmlFor="transfer-answer">Your value for x</label>
        <input
          id="transfer-answer"
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        <button className="primary" type="submit">
          Check transfer answer
        </button>
      </form>
      <p role="status" aria-live="polite">
        Mastery: {transfer.mastery.replaceAll("_", " ")}
      </p>
      {transfer.response !== null ? (
        <p>
          Preserved response:{" "}
          <span data-testid="learner-transfer-response">
            {transfer.response}
          </span>
        </p>
      ) : null}
      {diagnosis ? (
        <p data-testid="learner-diagnosis-summary">
          Repaired evidence: step {diagnosis.firstInvalidIndex},{" "}
          {diagnosis.category.replaceAll("_", " ")}; hint source{" "}
          {hint?.result.provenance ?? "not applicable"}.
        </p>
      ) : (
        <p>No false misconception was recorded for this completed solution.</p>
      )}
    </section>
  );
}
