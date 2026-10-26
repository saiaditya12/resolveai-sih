import { DEMO_STUDENT_ID } from "./similarity/types.ts";
import { demoStudent } from "./demo-student.ts";
import type { ComplaintDraft, LocalComplaint } from "./complaint-flow";
import type { CaseEvent, CaseResponse } from "./complaint-tracking";
import {
  applyOfficerAction,
  officerCells,
  type ComplaintQueueItem,
  type OfficerAction,
} from "./officer-model.ts";
import type { ComplaintIntelligenceResult } from "./intelligence/types";

export interface SharedComplaintRecord extends ComplaintQueueItem {
  incidentDate: string;
  contacted: "yes" | "no";
  contactDate: string;
  response: string;
  intelligence?: ComplaintIntelligenceResult;
  recommendedCellId?: string | null;
  routingStatus: "pending" | "routed" | "manual-review";
  routedAt?: string;
  overriddenByOfficer: boolean;
  trackingResponse?: CaseResponse;
}

function chronologicalEvents(
  existing: CaseEvent[],
  ...added: CaseEvent[]
): CaseEvent[] {
  const ids = new Set(existing.map((event) => event.id));
  for (const event of added) {
    if (ids.has(event.id))
      throw new Error(`Duplicate complaint event ID: ${event.id}`);
    ids.add(event.id);
  }
  return [...existing, ...added]
    .map((event, index) => ({ event, index }))
    .sort(
      (a, b) =>
        Date.parse(a.event.at) - Date.parse(b.event.at) ||
        a.index - b.index,
    )
    .map(({ event }) => event);
}

export function createSharedComplaintRecord(
  draft: ComplaintDraft,
  id: string,
  submittedAt: string,
): SharedComplaintRecord {
  if (!draft.institution || !draft.contacted)
    throw new Error("Incomplete draft");

  return {
    id,
    studentId: DEMO_STUDENT_ID,
    institution: draft.institution.name,
    title: draft.title.trim(),
    category: draft.category || "Other",
    status: "Submitted",
    updatedAt: submittedAt,
    submittedAt,
    description: draft.description.trim(),
    incidentDate: draft.incidentDate,
    contacted: draft.contacted,
    contactDate: draft.contacted === "yes" ? draft.contactDate : "",
    response: draft.contacted === "yes" ? draft.response : "",
    student: {
      name: demoStudent.name,
      incidentDate: draft.incidentDate,
      contacted: draft.contacted === "yes" ? "Yes" : "No",
    },
    evidence: draft.evidence.map(({ id: evidenceId, name, type, size }) => ({
      id: evidenceId,
      name,
      type,
      size,
      by: "Demo Student",
      at: submittedAt,
    })),
    cellId: "student",
    priority: "Medium",
    dueAt: "",
    summary: {
      text: "Intelligence analysis is in progress.",
      source: "Pending analysis",
      suggestion: "Review the submitted complaint and verify supporting details.",
      reason: "No officer recommendation has been made.",
    },
    events: [
      {
        id: `${id}-submitted`,
        at: submittedAt,
        title: "Complaint submitted",
        explanation:
          "The student created this local demo complaint. It is held in browser memory only.",
        actor: "Student",
      },
    ],
    similar: [],
    routingStatus: "pending",
    overriddenByOfficer: false,
  };
}

export function attachComplaintIntelligence(
  record: SharedComplaintRecord,
  intelligence: ComplaintIntelligenceResult,
): SharedComplaintRecord {
  if (record.intelligence)
    throw new Error("Complaint intelligence has already been attached.");

  const needsManualReview =
    intelligence.needsManualReview || !intelligence.recommendedCellId;
  const currentCellId = needsManualReview
    ? "student"
    : intelligence.recommendedCellId;
  const currentCell = officerCells.find((cell) => cell.id === currentCellId);
  if (!currentCell) throw new Error("Configured review cell is unavailable.");

  const events: CaseEvent[] = [
    {
      id: `${record.id}-analysis-${Date.parse(intelligence.analyzedAt)}`,
      at: intelligence.analyzedAt,
      title: "Analysis completed",
      explanation: `The complaint was classified as ${intelligence.category} with ${intelligence.confidence.toFixed(2)} confidence.`,
      actor: "System",
    },
  ];
  if (intelligence.source === "Fallback Rules") {
    events.push({
      id: `${record.id}-fallback-${Date.parse(intelligence.analyzedAt)}`,
      at: intelligence.analyzedAt,
      title: "Fallback rules used",
      explanation:
        "AI analysis was unavailable or not accepted; deterministic fallback rules supplied this result.",
      actor: "System",
    });
  }
  if (needsManualReview) {
    events.push({
      id: `${record.id}-manual-review-${Date.parse(intelligence.analyzedAt)}`,
      at: intelligence.analyzedAt,
      title: "Manual review required",
      explanation:
        intelligence.manualReviewReason ??
        "The complaint requires officer review before category-specific routing.",
      actor: "System",
    });
  } else {
    events.push({
      id: `${record.id}-routed-${Date.parse(intelligence.analyzedAt)}`,
      at: intelligence.analyzedAt,
      title: "Routed to demo cell",
      explanation: `Placed in ${currentCell.name}. This is a prototype mapping, not an official AICTE assignment.`,
      actor: "System",
    });
  }

  const wasTransferred = record.events.some(
    (event) => event.title === "Case transferred",
  );
  const stillPending =
    record.routingStatus === "pending" &&
    record.status === "Submitted" &&
    record.events.length === 1;
  return {
    ...record,
    category: intelligence.category,
    status: stillPending
      ? needsManualReview
        ? "Initial Review"
        : "Routed"
      : record.status,
    updatedAt:
      Date.parse(record.updatedAt) > Date.parse(intelligence.analyzedAt)
        ? record.updatedAt
        : intelligence.analyzedAt,
    cellId: stillPending ? currentCell.id : record.cellId,
    priority: intelligence.priority,
    summary: {
      text: intelligence.summary,
      source: intelligence.source,
      suggestion: "Review the complaint and verify details before taking action.",
      reason: intelligence.urgencyReason,
    },
    intelligence,
    recommendedCellId: intelligence.recommendedCellId,
    routingStatus: needsManualReview ? "manual-review" : "routed",
    routedAt: needsManualReview ? undefined : intelligence.analyzedAt,
    overriddenByOfficer: record.overriddenByOfficer || wasTransferred,
    events: chronologicalEvents(record.events, ...events),
  };
}

function studentStatus(record: SharedComplaintRecord): LocalComplaint["status"] {
  if (record.status === "Student Action Required") return "Needs Information";
  if (record.status === "Resolved" || record.status === "Closed")
    return "Resolved";
  if (record.status === "Escalated") return "Escalated";
  if (record.status === "Submitted" || record.status === "Initial Review")
    return "Submitted";
  if (record.status === "Routed") return "Under Review";
  return "Under Review";
}

export function toStudentComplaint(
  record: SharedComplaintRecord,
): LocalComplaint {
  return {
    id: record.id,
    institution: record.institution,
    title: record.title,
    category: record.category,
    status: studentStatus(record),
    updatedAt: record.updatedAt,
    submittedAt: record.submittedAt,
    description: record.description,
    incidentDate: record.incidentDate,
    contacted: record.contacted,
    contactDate: record.contactDate,
    response: record.response,
    evidence: record.evidence.map(({ id, name, type, size }) => ({
      id,
      name,
      type,
      size,
    })),
    workflowStatus: record.status,
    dueAt: record.dueAt,
    priority: record.priority,
    currentCellId: record.cellId,
    overriddenByOfficer: record.overriddenByOfficer,
    routingStatus: record.routingStatus,
    intelligence: record.intelligence,
    events: record.events,
    request: record.request,
    resolution: record.resolution,
    trackingResponse: record.trackingResponse,
  };
}

export function recordStudentResponse(
  record: SharedComplaintRecord,
  response: CaseResponse,
): SharedComplaintRecord {
  if (record.trackingResponse)
    throw new Error("A student response has already been recorded.");
  return {
    ...record,
    status: "Officer Review",
    updatedAt: response.at,
    request: undefined,
    trackingResponse: response,
    events: chronologicalEvents(record.events, {
        id: response.id,
        at: response.at,
        title: "Student response recorded locally",
        explanation:
          "The student added information in this browser. No document was uploaded and no officer was notified.",
        actor: "Student",
      }),
  };
}

export function applySharedOfficerAction(
  record: SharedComplaintRecord,
  action: OfficerAction,
  at: string,
  eventId: string,
): SharedComplaintRecord {
  const updated = applyOfficerAction(record, action, at, eventId);
  return {
    ...record,
    ...updated,
    trackingResponse:
      action.type === "request" && action.recipient === "Student"
        ? undefined
        : record.trackingResponse,
    events: chronologicalEvents(
      record.events,
      ...updated.events.slice(record.events.length),
    ),
  };
}
