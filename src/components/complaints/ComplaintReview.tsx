import { type ComplaintDraft, fileSize } from "@/lib/complaint-flow";
export function ComplaintReview({
  draft,
  onEdit,
}: {
  draft: ComplaintDraft;
  onEdit: (step: number) => void;
}) {
  return (
    <div className="complaint-review">
      <section>
        <header>
          <h3>Institution</h3>
          <button
            type="button"
            onClick={() => onEdit(0)}
            aria-label="Edit institution"
          >
            Edit ↗
          </button>
        </header>
        <strong>{draft.institution?.name}</strong>
        <p>
          {draft.institution?.city}, {draft.institution?.state} ·{" "}
          {draft.institution?.type}
        </p>
      </section>
      <section>
        <header>
          <h3>Complaint details</h3>
          <button
            type="button"
            onClick={() => onEdit(1)}
            aria-label="Edit complaint details"
          >
            Edit ↗
          </button>
        </header>
        <h4>{draft.title}</h4>
        <p className="review-description">{draft.description}</p>
        <dl>
          <div>
            <dt>Category hint</dt>
            <dd>{draft.category || "Not specified"}</dd>
          </div>
          <div>
            <dt>Incident date</dt>
            <dd>{draft.incidentDate || "Not provided"}</dd>
          </div>
          <div>
            <dt>Institution contacted?</dt>
            <dd>{draft.contacted === "yes" ? "Yes" : "No"}</dd>
          </div>
          {draft.contacted === "yes" && (
            <>
              <div>
                <dt>Date contacted</dt>
                <dd>{draft.contactDate || "Not provided"}</dd>
              </div>
              <div className="review-wide">
                <dt>Response received</dt>
                <dd>{draft.response || "Not provided"}</dd>
              </div>
            </>
          )}
        </dl>
      </section>
      <section>
        <header>
          <h3>
            Evidence <span>({draft.evidence.length})</span>
          </h3>
          <button
            type="button"
            onClick={() => onEdit(2)}
            aria-label="Edit evidence"
          >
            Edit ↗
          </button>
        </header>
        {draft.evidence.length ? (
          <ul>
            {draft.evidence.map((file) => (
              <li key={file.id}>
                <strong>{file.name}</strong>
                <span>
                  {file.type} · {fileSize(file.size)} · Local only
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No evidence selected. You can submit the demo without it.</p>
        )}
      </section>
    </div>
  );
}
