import { useEffect, useState } from "react";
import { cellDisplayName, institutionDisplayName, systemDisplayText, roleDisplayName, auditDisplayText, personDisplayName } from "@/lib/presentation";
import { formatDemoDate } from "@/lib/demo-student";
import { formatEventTime } from "@/lib/complaint-tracking";
import { fileSize } from "@/lib/complaint-flow";
import {
  OFFICER_DEMO_CLOCK,
  officerCells,
  officerSla,
  type ComplaintQueueItem,
} from "@/lib/officer-model";
import { getInstitutionComplaintHistory } from "@/lib/patterns/institution-patterns";
import { institutionPatternPolicy } from "@/lib/patterns/types";
import { formatDuration } from "@/lib/sla/sla";
import { prototypeSlaPolicy } from "@/lib/sla/policy";
import { OfficerStatus, PriorityBadge, SlaBadge } from "./OfficerBadges";
import { useComplaintStore } from "@/components/ComplaintStoreProvider";
import type { InstitutionComplaintStats } from "@/lib/patterns/institution-stats";

function isInstitutionStatsResponse(
  value: unknown,
): value is { stats: InstitutionComplaintStats } {
  if (!value || typeof value !== "object" || !("stats" in value)) return false;
  const stats = value.stats;
  return (
    !!stats &&
    typeof stats === "object" &&
    "total" in stats &&
    typeof stats.total === "number" &&
    "recentCount" in stats &&
    typeof stats.recentCount === "number" &&
    "open" in stats &&
    typeof stats.open === "number" &&
    "resolved" in stats &&
    typeof stats.resolved === "number" &&
    "escalated" in stats &&
    typeof stats.escalated === "number" &&
    "topCategory" in stats &&
    typeof stats.topCategory === "string" &&
    "asOf" in stats &&
    typeof stats.asOf === "string" &&
    "statusBreakdown" in stats &&
    !!stats.statusBreakdown &&
    typeof stats.statusBreakdown === "object" &&
    "priorityBreakdown" in stats &&
    !!stats.priorityBreakdown &&
    typeof stats.priorityBreakdown === "object"
  );
}

export function OfficerCaseHeader({ item }: { item: ComplaintQueueItem }) {
  return (
    <header className="officer-case-header">
      <p className="eyebrow">{item.id} / COMPLAINT</p>
      <h1>{item.title}</h1>
      <p className="officer-case-institution">{institutionDisplayName(item.institution)}</p>
      <div className="officer-badges">
        <OfficerStatus status={item.status} />
        <PriorityBadge priority={item.priority} />
      </div>
      <dl className="officer-facts">
        <div>
          <dt>Category</dt>
          <dd>{item.category}</dd>
        </div>
        <div>
          <dt>Submitted</dt>
          <dd>{formatDemoDate(item.submittedAt)}</dd>
        </div>
        <div>
          <dt>
            {item.routingStatus === "manual-review" &&
            !item.overriddenByOfficer
              ? "Review status"
              : "Assigned cell"}
          </dt>
          <dd>
            {item.routingStatus === "manual-review" &&
            !item.overriddenByOfficer
              ? "Manual review queue"
              : cellDisplayName(officerCells.find((c) => c.id === item.cellId)?.name)}
          </dd>
        </div>
        <div>
          <dt>Last activity</dt>
          <dd>{formatEventTime(item.updatedAt)} IST</dd>
        </div>
      </dl>
    </header>
  );
}
export function CaseSummaryPanel({ item }: { item: ComplaintQueueItem }) {
  if (item.intelligence) {
    const intelligence = item.intelligence;
    const recommendedCell = officerCells.find(
      (cell) => cell.id === intelligence.recommendedCellId,
    );
    const currentCell = officerCells.find((cell) => cell.id === item.cellId);
    return (
      <section className="officer-panel officer-summary">
        <p className="eyebrow">01 / SYSTEM ANALYSIS</p>
        <h2>Complaint understanding.</h2>
        <p className="officer-summary-text">{systemDisplayText(intelligence.summary)}</p>
        <dl className="officer-facts">
          <div>
            <dt>Identified category</dt>
            <dd>{intelligence.category}</dd>
          </div>
          <div>
            <dt>Priority</dt>
            <dd>{item.priority}</dd>
          </div>
          <div>
            <dt>Urgency reason</dt>
            <dd>{intelligence.urgencyReason}</dd>
          </div>
          <div>
            <dt>System recommendation</dt>
            <dd>{cellDisplayName(recommendedCell?.name || "Manual review required")}</dd>
          </div>
          <div>
            <dt>Current Responsibility</dt>
            <dd>
              {item.routingStatus === "manual-review" &&
              !item.overriddenByOfficer
                ? "Manual review queue"
                : cellDisplayName(currentCell?.name || "Manual review queue")}
            </dd>
          </div>
          <div>
            <dt>Routing status</dt>
            <dd>
              {item.routingStatus === "manual-review"
                ? "Manual review required"
                : item.overriddenByOfficer
                  ? "Officer override"
                  : intelligence.reviewRecommended
                    ? "Routed — officer review recommended"
                    : "Routed"}
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
            <dt>Source</dt>
            <dd>
              {intelligence.source === "AI"
                ? "AI-assisted analysis"
                : intelligence.source === "Fallback Rules"
                  ? "Fallback rules"
                  : intelligence.source}
            </dd>
          </div>
        </dl>
        <p className="officer-fine">
          {systemDisplayText(intelligence.routingReason)}{" "}
          {intelligence.manualReviewReason
            ? `Manual review: ${systemDisplayText(intelligence.manualReviewReason || "")}`
            : ""}
        </p>
        {item.overriddenByOfficer && (
          <p className="officer-fine" role="status">
            The original system recommendation is preserved above. The current
            officer decision is recorded in the case history.
          </p>
        )}
      </section>
    );
  }
  return (
    <section className="officer-panel officer-summary">
      <p className="eyebrow">01 / CASE SUMMARY</p>
      <h2>The issue, at a glance.</h2>
      <p className="officer-summary-text">{systemDisplayText(item.summary.text)}</p>
      <p className="officer-fine">
        {systemDisplayText(item.summary.source)}. No LLM generated this summary. Verify against the
        original complaint and supporting records.
      </p>
    </section>
  );
}
export function EvidencePanel({ item }: { item: ComplaintQueueItem }) {
  return (
    <section className="officer-panel">
      <p className="eyebrow">02 / EVIDENCE</p>
      <h2>The supporting record.</h2>
      <p className="officer-fine">
        File metadata only. Downloads are not available here.
      </p>
      {item.evidence.length ? (
        <ul className="officer-evidence">
          {item.evidence.map((file) => (
            <li key={file.id}>
              <span aria-hidden="true">↳</span>
              <div>
                <strong>{file.name}</strong>
                <p>
                  {file.type} · {fileSize(file.size)}
                </p>
                <small>
                  Listed by {personDisplayName(file.by)} · {formatDemoDate(file.at)}
                </small>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No evidence listed in this case. Request clarification before
          relying on unsupported details.
        </p>
      )}
    </section>
  );
}
export function StudentResponsesPanel({ item }: { item: ComplaintQueueItem }) {
  const responses = [...(item.studentResponses ?? [])].sort(
    (a, b) => Date.parse(a.at) - Date.parse(b.at),
  );
  if (responses.length === 0) return null;
  return (
    <section className="officer-panel" aria-labelledby="student-responses-heading">
      <p className="eyebrow">STUDENT RESPONSES</p>
      <h2 id="student-responses-heading">Information provided by the student.</h2>
      {responses.map((response, index) => {
        const requestEvent = item.events.find(
          (event) => event.id === response.requestEventId,
        );
        return (
          <div className="officer-student-response" key={response.id}>
            <h3>Response received · {formatEventTime(response.at)} IST</h3>
            {requestEvent && (
              <p className="officer-fine">
                Response to: {requestEvent.explanation}
              </p>
            )}
            <p className="officer-preserve">{response.text}</p>
            {response.evidence.length > 0 && (
              <>
                <h4>Evidence metadata</h4>
                <ul className="officer-evidence">
                  {response.evidence.map((file) => (
                    <li key={file.id}>
                      <span aria-hidden="true">↳</span>
                      <div>
                        <strong>{file.name}</strong>
                        <p>
                          {file.type} · {fileSize(file.size)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {index < responses.length - 1 && <hr />}
          </div>
        );
      })}
    </section>
  );
}
export function OriginalOfficerComplaint({
  item,
}: {
  item: ComplaintQueueItem;
}) {
  return (
    <details className="officer-panel officer-original">
      <summary>Original complaint & student details</summary>
      <p className="officer-preserve">{item.description}</p>
      <dl className="officer-facts">
        <div>
          <dt>Student</dt>
          <dd>{personDisplayName(item.student.name)}</dd>
        </div>
        <div>
          <dt>Incident date</dt>
          <dd>{item.student.incidentDate || "Not provided"}</dd>
        </div>
        <div>
          <dt>Prior institution contact</dt>
          <dd>{item.student.contacted}</dd>
        </div>
      </dl>
    </details>
  );
}
export function OfficerCaseTimeline({ item }: { item: ComplaintQueueItem }) {
  return (
    <section className="officer-panel">
      <p className="eyebrow">03 / CASE HISTORY</p>
      <h2>A visible trail of decisions.</h2>
      <p className="officer-fine">
        Recorded actions and updates for this complaint.
      </p>
      <ol className="officer-events">
        {item.events.map((event) => (
          <li key={event.id}>
            <div>
              <time dateTime={event.at}>{formatEventTime(event.at)} IST</time>
              <span>{personDisplayName(event.audit?.actor_name || event.actor)}{event.audit?.actor_role ? ` / ${roleDisplayName(event.audit.actor_role)}` : ""}{event.audit?.actor_cell ? ` / ${cellDisplayName(officerCells.find(c => c.id === event.audit?.actor_cell)?.name || "Review cell")}` : ""}</span>
            </div>
            <div>
              <h3>{auditDisplayText(event.title)}</h3>
              <p className="officer-preserve">{auditDisplayText(event.explanation)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
export function InstitutionHistoryPanel({
  item,
  cases,
}: {
  item: ComplaintQueueItem;
  cases: ComplaintQueueItem[];
}) {
  const { mode } = useComplaintStore();
  const [statsResult, setStatsResult] = useState<{
    institution: string;
    stats: InstitutionComplaintStats | null;
    error: string;
  }>({ institution: "", stats: null, error: "" });
  const persistedStats =
    statsResult.institution === item.institution ? statsResult.stats : null;
  const statsError =
    statsResult.institution === item.institution ? statsResult.error : "";
  useEffect(() => {
    if (mode !== "persistent") return;

    const controller = new AbortController();
    const query = new URLSearchParams({ institution: item.institution });
    void fetch(`/api/institutions/history?${query}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok || !isInstitutionStatsResponse(payload))
          throw new Error("Institution history is temporarily unavailable.");
        setStatsResult({
          institution: item.institution,
          stats: payload.stats,
          error: "",
        });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setStatsResult({
            institution: item.institution,
            stats: null,
            error:
              error instanceof Error
                ? error.message
                : "Institution history is temporarily unavailable.",
          });
        }
      });
    return () => controller.abort();
  }, [item.institution, mode]);

  const statsAsOf =
    mode === "persistent"
      ? persistedStats?.asOf ?? new Date().toISOString()
      : OFFICER_DEMO_CLOCK;
  const history = getInstitutionComplaintHistory(
    cases,
    item.institution,
    statsAsOf,
  );
  const aggregate = mode === "persistent" ? persistedStats : history;
  const currentCluster = history.clusters.find((cluster) =>
    cluster.complaintIds.includes(item.id),
  );
  return (
    <section className="officer-panel">
      <p className="eyebrow">INSTITUTION COMPLAINT HISTORY</p>
      <h2>{institutionDisplayName(history.institution)}</h2>
      {mode === "persistent" && !persistedStats && (
        <p role={statsError ? "alert" : "status"}>
          {statsError || "Loading institution history…"}
        </p>
      )}
      <dl className="officer-history-counts">
        <div>
          <dt>Complaints · 90 days</dt>
          <dd>{aggregate?.total ?? "—"}</dd>
        </div>
        <div>
          <dt>Last 30 days</dt>
          <dd>{aggregate?.recentCount ?? "—"}</dd>
        </div>
        <div>
          <dt>Open</dt>
          <dd>{aggregate?.open ?? "—"}</dd>
        </div>
        <div>
          <dt>Resolved</dt>
          <dd>{aggregate?.resolved ?? "—"}</dd>
        </div>
        <div>
          <dt>Escalated</dt>
          <dd>{aggregate?.escalated ?? "—"}</dd>
        </div>
      </dl>
      <p>Top category: {aggregate?.topCategory ?? "—"}</p>
      {currentCluster ? (
        <div className="officer-institution-cluster">
          <h3>Repeated issue pattern detected</h3>
          <p>{currentCluster.label}</p>
          <p>
            This complaint is part of a related group of{" "}
            {currentCluster.complaintCount} complaints;{" "}
            {currentCluster.recentCount} were submitted in the last{" "}
            {institutionPatternPolicy.patternWindowDays} days.
          </p>
          <p>
            {currentCluster.recentCount === 0
              ? "No recent activity"
              : currentCluster.trend === "New pattern"
              ? "Newly observed issue"
              : `${currentCluster.trend} complaint activity`}
          </p>
          {currentCluster.commonIssueSignals.length > 0 && (
            <p>
              Common issue signals:{" "}
              {currentCluster.commonIssueSignals.join(", ")}.
            </p>
          )}
          {currentCluster.recentCount >=
            institutionPatternPolicy.repeatOccurrenceMinimum && (
            <p>
              Repeated occurrence: {currentCluster.recentCount} complaints in
              this issue group in the last{" "}
              {institutionPatternPolicy.patternWindowDays} days.
            </p>
          )}
        </div>
      ) : (
        <p>No related issue group is currently identified in this case.</p>
      )}
      <div className="officer-history-breakdowns">
        <div>
          <h3>Workflow status</h3>
          <ul>
            {Object.entries(aggregate?.statusBreakdown ?? {}).map(([status, count]) => (
              <li key={status}>
                <span>{status}</span>
                <strong>{count}</strong>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Priority context</h3>
          <ul>
            {Object.entries(aggregate?.priorityBreakdown ?? {}).map(
              ([priority, count]) => (
                <li key={priority}>
                  <span>{priority}</span>
                  <strong>{count}</strong>
                </li>
              ),
            )}
          </ul>
        </div>
      </div>
      <p className="officer-fine">
        These counts and issue signals derive from records. They
        are decision-support context, not findings about the institution.
      </p>
    </section>
  );
}
export function OwnerSlaPanel({ item }: { item: ComplaintQueueItem }) {
  const sla = officerSla(item);
  return (
    <section className="officer-panel">
      <p className="eyebrow">CURRENT RESPONSIBILITY</p>
      <h2>
        {item.routingStatus === "manual-review" && !item.overriddenByOfficer
          ? "Manual review queue"
          : cellDisplayName(officerCells.find((c) => c.id === item.cellId)?.name)}
      </h2>
      <p className="officer-fine">
        {item.routingStatus === "manual-review" && !item.overriddenByOfficer
          ? "This case is in an unassigned manual review queue; no officer is assigned."
          : "Current responsibility follows the configured routing."}
      </p>
      <div className="officer-owner-state">
        <OfficerStatus status={item.status} />
        <PriorityBadge priority={item.priority} />
      </div>
      <hr />
      <p className="eyebrow">RESPONSE WINDOW</p>
      <SlaBadge item={item} />
      <h3>SLA status: {sla.state === "On Track" ? "Normal" : sla.state}</h3>
      <p>Priority target: {sla.targetHours} hours under the configured service-level target.</p>
      {sla.deadlineAt ? (
        <p>
          Deadline:{" "}
          {new Intl.DateTimeFormat("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Kolkata",
          }).format(new Date(sla.deadlineAt))}
        </p>
      ) : (
        <p>No SLA deadline could be calculated from this record.</p>
      )}
      <p>
        {sla.state === "Complete"
          ? "Response window completed."
          : sla.state === "Paused"
            ? `Paused while waiting for student · ${formatDuration(sla.remainingMs)}`
            : formatDuration(sla.remainingMs)}
      </p>
      {sla.paused && (
        <p>
          Student information requests pause the officer clock. Recorded paused
          time: {formatDuration(sla.pausedMs)}.
        </p>
      )}
      {sla.escalationRecommended && (
        <div className="officer-escalation-recommendation">
          <strong>Escalation recommended</strong>
          <p>
            This case is overdue beyond the configured grace period. An officer
            may use the existing Escalate action; no automatic state or owner
            change is made.
          </p>
        </div>
      )}
      {item.escalationReason && (
        <p className="officer-preserve">
        Escalation reason: {systemDisplayText(item.escalationReason)}
        </p>
      )}
      <p className="officer-fine">
        {systemDisplayText(prototypeSlaPolicy.label)}. Student information requests pause the
        officer response clock. The fixed monitoring clock is{" "}
        {formatEventTime(OFFICER_DEMO_CLOCK)} IST; this is not an official
        AICTE SLA.
      </p>
    </section>
  );
}
export function SuggestedNextAction({ item }: { item: ComplaintQueueItem }) {
  return (
    <section className="officer-panel">
      <p className="eyebrow">SUGGESTED NEXT ACTION</p>
      <h2>{item.resolution ? "Outcome recorded." : "A possible next step."}</h2>
      <p>
        {item.resolution
          ? "This case is resolved. Review the recorded outcome and history."
          : systemDisplayText(item.summary.suggestion)}
      </p>
      <p className="officer-fine">
        {item.resolution
          ? "No further case actions are enabled."
          : systemDisplayText(item.summary.reason)}{" "}
        Prewritten guidance, not AI advice.
      </p>
    </section>
  );
}
