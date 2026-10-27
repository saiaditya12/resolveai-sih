import { cellDisplayName } from "@/lib/presentation";
import Link from "next/link";
import type { LocalComplaint } from "@/lib/complaint-flow";
import { StatusBadge } from "@/components/student/StatusBadge";
export function SubmissionSuccess({
  complaint,
  analysisPending,
  analysisError,
  mode,
}: {
  complaint: LocalComplaint;
  analysisPending: boolean;
  analysisError: string;
  mode: "persistent" | "demo";
}) {
  const intelligence = complaint.intelligence;
  const routingLabel = analysisPending
    ? "Determining routing…"
    : intelligence?.needsManualReview || complaint.routingStatus === "manual-review"
      ? "Manual review required"
      : intelligence?.recommendedCellName || "Routing unavailable";
  const sourceLabel =
    intelligence?.source === "AI"
      ? "AI-assisted analysis"
      : intelligence?.source === "Fallback Rules"
        ? "Fallback rules"
        : intelligence?.source || "Not analyzed";
  const statusMessage = analysisError
    ? analysisError
    : analysisPending
      ? "Complaint received. Determining routing…"
      : intelligence?.needsManualReview
        ? "Complaint received. Manual routing review required."
        : intelligence?.source === "Fallback Rules"
          ? "Complaint received. Routing was determined using fallback rules."
          : "Complaint received and routed using the configured mapping.";

  return (
    <section className="submission-success" aria-busy={analysisPending}>
      <span className="success-seal" aria-hidden="true">
        ✓
      </span>
      <span className="demo-badge">
        {mode === "persistent"
          ? "SAVED TO YOUR ACCOUNT · NOT SENT TO AICTE"
          : "COMPLAINT RECEIVED"}
      </span>
      <h2>Complaint submitted.</h2>
      <p
        role={analysisError ? "alert" : "status"}
        aria-live={analysisError ? "assertive" : "polite"}
      >
        {statusMessage}
      </p>
      <div className="success-receipt">
        <p className="eyebrow">YOUR COMPLAINT ID</p>
        <strong>{complaint.id}</strong>
        <StatusBadge status={complaint.status} />
        <dl>
          <div>
            <dt>Institution</dt>
            <dd>{complaint.institution}</dd>
          </div>
          <div>
            <dt>Title</dt>
            <dd>{complaint.title}</dd>
          </div>
        </dl>
        <section className="submission-understanding" aria-labelledby="understanding-title">
          <p className="eyebrow">COMPLAINT UNDERSTANDING</p>
          <h3 id="understanding-title">What happens next</h3>
          <dl>
            <div>
              <dt>Identified category</dt>
              <dd>{intelligence?.category || "Analysis in progress"}</dd>
            </div>
            <div>
              <dt>Routing</dt>
              <dd>{cellDisplayName(routingLabel)}</dd>
            </div>
            <div>
              <dt>Routing status</dt>
              <dd>
                {analysisPending
                  ? "Analysis in progress"
                  : intelligence?.needsManualReview
                    ? "Manual review required"
                    : intelligence?.reviewRecommended
                      ? "Routed — officer review recommended"
                    : complaint.workflowStatus === "Routed"
                      ? "Routed"
                      : "Pending"}
              </dd>
            </div>
            {intelligence && (
              <div>
                <dt>Confidence</dt>
                <dd>
                  {Math.round(intelligence.confidence * 100)}% ·{" "}
                  {intelligence.needsManualReview
                    ? "manual review required"
                    : intelligence.reviewRecommended
                      ? "review recommended"
                      : "automatic routing"}
                </dd>
              </div>
            )}
            <div>
              <dt>Analysis source</dt>
              <dd>{sourceLabel}</dd>
            </div>
          </dl>
          {intelligence?.needsManualReview && (
            <p className="flow-hint">
              This complaint is visible to the review queue. No cell-specific
              recommendation was assigned.
            </p>
          )}
        </section>
      </div>
      <p className="flow-callout">
        {mode === "persistent"
          ? "Your complaint remains in your account after refresh. Evidence file contents are not uploaded; only metadata is stored."
          : "Available while navigating between the student and officer workspaces in this browser session. Refreshing or closing the tab clears your cases. Complaint text is sent to server-side analysis; evidence files are not uploaded."}
      </p>
      <div className="actions">
        <Link
          className="button primary"
          href={`/student/complaints/${complaint.id}`}
        >
          Track complaint ↗
        </Link>
        <Link className="button secondary" href="/student/dashboard">
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}
