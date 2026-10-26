import type { Complaint } from "@/lib/demo-student";
import { formatDemoDate } from "@/lib/demo-student";
import { fileSize } from "@/lib/complaint-flow";
import {
  stages,
  stageState,
  formatEventTime,
  nextMessage,
  type TrackingCase,
  type EvidenceMetadata,
} from "@/lib/complaint-tracking";
export function ComplaintHeader({
  complaint,
  data,
}: {
  complaint: Complaint;
  data: TrackingCase;
}) {
  return (
    <header className="tracking-header">
      <p className="eyebrow">
        {complaint.id} /{" "}
        {data.local ? "LOCAL DEMO RECORD" : "FICTIONAL CASE STUDY"}
      </p>
      <div className="tracking-title">
        <h1>{complaint.title}</h1>
        <span
          className={`tracking-status ${data.request || data.status === "Escalated" ? "needs-attention" : ""}`}
        >
          {data.resolution ? "✓" : "●"} {data.status}
        </span>
      </div>
      <p className="tracking-institution">{complaint.institution}</p>
      <dl className="tracking-facts">
        <div>
          <dt>
            {data.local && data.intelligence
              ? "Identified category"
              : "Category hint"}
          </dt>
          <dd>{complaint.category}</dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>
            <time dateTime={data.submittedAt}>
              {formatDemoDate(data.submittedAt)}
            </time>
          </dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>
            <time dateTime={complaint.updatedAt}>
              {formatEventTime(complaint.updatedAt)} IST
            </time>
          </dd>
        </div>
        <div>
          <dt>Responsible authority</dt>
          <dd>{data.owner?.cell || "Not assigned"}</dd>
        </div>
      </dl>
    </header>
  );
}
export function ComplaintTimeline({ data }: { data: TrackingCase }) {
  return (
    <section
      className="tracking-card journey-card"
      aria-labelledby="journey-heading"
    >
      <div className="tracking-section-head">
        <div>
          <p className="eyebrow">01 / YOUR COMPLAINT JOURNEY</p>
          <h2 id="journey-heading">Every step, in view.</h2>
        </div>
        <span className="tracking-caption">
          {data.local
            ? data.routingStatus === "routed"
              ? "Analysis and prototype routing recorded"
              : data.routingStatus === "manual-review"
                ? "Manual review recorded"
                : "Analysis pending"
            : "Illustrative demo progression"}
        </span>
      </div>
      <ol className="case-stages">
        {stages.map((label, index) => {
          const state = stageState(data.status, index);
          return (
            <li
              key={label}
              className={state}
              aria-current={state === "current" ? "step" : undefined}
            >
              <span className="stage-marker" aria-hidden="true">
                {state === "completed"
                  ? "✓"
                  : String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <strong>{label}</strong>
                <span>
                  {state === "completed"
                    ? "Completed"
                    : state === "current"
                      ? data.status === "Submitted"
                        ? "Recorded · awaiting review"
                        : data.status === "Student Action Required"
                          ? "Paused · your action needed"
                          : data.status === "Escalated"
                            ? "Current · escalated"
                            : "Current stage"
                      : "Pending"}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
export function ComplaintUnderstanding({ data }: { data: TrackingCase }) {
  if (!data.local || !data.intelligence) return null;
  const intelligence = data.intelligence;
  return (
    <section className="tracking-card tracking-understanding">
      <p className="eyebrow">COMPLAINT UNDERSTANDING</p>
      <h2>Analysis and routing</h2>
      <dl>
        <div>
          <dt>Identified category</dt>
          <dd>{intelligence.category}</dd>
        </div>
        <div>
          <dt>Current demo cell</dt>
          <dd>{data.owner?.cell || "Not assigned"}</dd>
        </div>
        <div>
          <dt>Routing status</dt>
          <dd>
            {data.routingStatus === "manual-review"
              ? "Manual review required"
              : data.routingStatus === "routed"
                ? intelligence.reviewRecommended
                  ? "Routed — officer review recommended"
                  : "Routed"
                : "Pending"}
          </dd>
        </div>
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
        <div>
          <dt>Analysis source</dt>
          <dd>
            {intelligence.source === "AI"
              ? "AI-assisted analysis"
              : intelligence.source === "Fallback Rules"
                ? "Fallback rules"
                : intelligence.source}
          </dd>
        </div>
      </dl>
      {intelligence.needsManualReview && (
        <p>
          A demo officer must review the complaint before category-specific
          routing. No specific authority has been assigned.
        </p>
      )}
    </section>
  );
}
export function NextActionCard({
  data,
  onRespond,
}: {
  data: TrackingCase;
  onRespond: () => void;
}) {
  return (
    <section
      className={`tracking-card next-action ${data.request ? "action-required" : ""}`}
      aria-labelledby="next-heading"
    >
      <p className="eyebrow">
        {data.request ? "YOUR ACTION IS REQUIRED" : "THE NEXT STEP"}
      </p>
      <h2 id="next-heading">What happens next?</h2>
      <p>{nextMessage(data)}</p>
      {data.request && (
        <div className="request-detail">
          <strong>{data.request.prompt}</strong>
          {data.request.dueAt ? (
            <p>
              Response requested by{" "}
              <time dateTime={data.request.dueAt}>
                {formatDemoDate(data.request.dueAt)} · 5:00 pm IST
              </time>
            </p>
          ) : (
            <p>No response due date was specified.</p>
          )}
          <button className="button primary" onClick={onRespond}>
            Provide information <span aria-hidden="true">↗</span>
          </button>
        </div>
      )}
      {data.response && (
        <p className="tracking-confirmation" role="status">
          ✓ Demo response saved in this workspace only.
        </p>
      )}
    </section>
  );
}
export function CurrentOwnerCard({ data }: { data: TrackingCase }) {
  return (
    <section className="tracking-card owner-card">
      <p className="eyebrow">CURRENT OWNER</p>
      <h2>{data.owner?.cell || "Awaiting assignment"}</h2>
      <dl>
        <div>
          <dt>Assigned officer</dt>
          <dd>{data.owner?.officer || "Not assigned"}</dd>
        </div>
        <div>
          <dt>Responsibility</dt>
          <dd>
            {data.resolution
              ? "Outcome recorded"
              : data.owner
                ? "Review and coordinate the next step"
                : "Initial review has not started"}
          </dd>
        </div>
      </dl>
      <p className="tracking-caption">
        Fictional cell and officer names. No official AICTE routing or live
        assignment.
      </p>
    </section>
  );
}
export function SlaStatus({ data }: { data: TrackingCase }) {
  const paused =
    data.status === "Student Action Required" &&
    Boolean(data.request) &&
    !data.response;
  return (
    <section
      className={`tracking-card sla-card sla-${paused ? "paused" : data.sla.state.toLowerCase().replaceAll(" ", "-")}`}
    >
      <p className="eyebrow">RESPONSE WINDOW / DEMO</p>
      <span className="sla-state">{paused ? "Paused" : data.sla.state}</span>
      <h2>{paused ? "Waiting for your information" : data.sla.remaining}</h2>
      <p>{paused ? "Prototype response clock paused" : data.sla.window}</p>
      {data.sla.dueAt && (
        <p>Target: {formatDemoDate(data.sla.dueAt)} · 10:00 am IST</p>
      )}
      {data.sla.state === "Overdue" && (
        <p>The sample deadline has passed. No escalation is recorded yet.</p>
      )}
      {data.sla.state === "Escalated" && (
        <p>
          The sample deadline was exceeded and the case moved to a fictional
          escalation reviewer.
        </p>
      )}
      {paused && (
        <p>
          This demo response window is paused while we wait for your requested
          information. It resumes after you respond. Your response is visible
          only in your local demo record.
        </p>
      )}
      <p className="tracking-caption">
        {data.sla.dueAt
          ? "Fixed scenario as of 24 Oct 2026, 10:00 am IST. "
          : ""}
        Illustrative timing only, not AICTE SLA rules or a live countdown.
      </p>
    </section>
  );
}
export function CaseEvents({ data }: { data: TrackingCase }) {
  return (
    <section className="tracking-card">
      <p className="eyebrow">02 / CASE HISTORY</p>
      <h2>The record so far.</h2>
      <ol className="case-events">
        {data.events.map((event) => (
          <li key={event.id}>
            <div className="event-time">
              <time dateTime={event.at}>{formatEventTime(event.at)} IST</time>
              <span>{event.actor}</span>
            </div>
            <div>
              <h3>{event.title}</h3>
              <p>{event.explanation}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
export function EvidenceRows({ files }: { files: EvidenceMetadata[] }) {
  return files.length ? (
    <ul className="tracking-evidence">
      {files.map((file) => (
        <li key={file.id}>
          <span aria-hidden="true">↳</span>
          <div>
            <strong>{file.name}</strong>
            <span>
              {file.type} · {fileSize(file.size)} · Metadata only
            </span>
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <p>No evidence selected.</p>
  );
}
export function EvidenceHistory({ data }: { data: TrackingCase }) {
  return (
    <section className="tracking-card">
      <p className="eyebrow">03 / EVIDENCE & RESPONSES</p>
      <h2>The supporting context.</h2>
      <p className="tracking-caption">
        {data.local
          ? "Local selection metadata."
          : "Fictional sample metadata."}{" "}
        No remote files or downloads are available.
      </p>
      <div className="evidence-history-item">
        <h3>At submission · {formatDemoDate(data.submittedAt)}</h3>
        <EvidenceRows files={data.evidence} />
      </div>
      {data.events
        .filter((event) => event.id === "request")
        .map((event) => (
          <div className="evidence-history-item" key={event.id}>
            <h3>
              {event.actor} requested · {formatEventTime(event.at)} IST
            </h3>
            <p>{event.explanation}</p>
          </div>
        ))}
      {data.response && (
        <div className="evidence-history-item">
          <h3>
            Student responded locally · {formatEventTime(data.response.at)} IST
          </h3>
          <p className="tracking-copy">
            {data.response.text ||
              "Supporting evidence selected without a text response."}
          </p>
          <EvidenceRows files={data.response.evidence} />
        </div>
      )}
    </section>
  );
}
export function OriginalComplaint({
  complaint,
  data,
}: {
  complaint: Complaint;
  data: TrackingCase;
}) {
  return (
    <details className="tracking-card original-complaint">
      <summary>
        Original complaint <span>View details +</span>
      </summary>
      <p className="tracking-copy">{data.description}</p>
      <dl className="tracking-facts">
        <div>
          <dt>Category hint</dt>
          <dd>{complaint.category}</dd>
        </div>
        <div>
          <dt>Incident date</dt>
          <dd>{data.incidentDate || "Not provided"}</dd>
        </div>
        <div>
          <dt>Institution previously contacted?</dt>
          <dd>{data.contacted}</dd>
        </div>
      </dl>
      <h3>Submitted evidence</h3>
      <EvidenceRows files={data.evidence} />
    </details>
  );
}
export function ResolvedState({
  data,
  feedback,
  onFeedback,
}: {
  data: TrackingCase;
  feedback?: "yes" | "no";
  onFeedback: (value: "yes" | "no") => void;
}) {
  if (!data.resolution) return null;
  return (
    <section className="tracking-card resolved-card">
      <p className="eyebrow">✓ RESOLVED / FICTIONAL OUTCOME</p>
      <h2>An outcome, on record.</h2>
      <p>{data.resolution.summary}</p>
      <dl>
        <div>
          <dt>Resolved date</dt>
          <dd>{formatDemoDate(data.resolution.at)}</dd>
        </div>
        <div>
          <dt>Final action taken</dt>
          <dd>{data.resolution.action}</dd>
        </div>
      </dl>
      <fieldset className="resolution-feedback">
        <legend>Was this resolution helpful?</legend>
        <div>
          {(["yes", "no"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={feedback === value}
              onClick={() => onFeedback(value)}
            >
              {value === "yes" ? "Yes" : "No"}
            </button>
          ))}
        </div>
      </fieldset>
      <p role="status">
        {feedback
          ? `Your “${feedback}” feedback is saved in memory only. Thank you.`
          : "Optional demo feedback. Nothing is sent to a server."}
      </p>
    </section>
  );
}
