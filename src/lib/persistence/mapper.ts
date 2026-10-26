import type { ComplaintQueueItem } from "@/lib/officer-model";
import type { SharedComplaintRecord } from "@/lib/complaint-store";
import type { ComplaintIntelligenceResult } from "@/lib/intelligence/types";
import type { CaseEvent } from "@/lib/complaint-tracking";

type Row = Record<string, unknown>;

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function jsonObject<T>(value: unknown): T | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as T)
    : undefined;
}

export function mapPersistentComplaint(
  row: Row,
  relations: {
    profile?: Row;
    intelligence?: Row;
    events?: Row[];
    evidence?: Row[];
    responses?: Row[];
  } = {},
): SharedComplaintRecord {
  const intelligence = jsonObject<ComplaintIntelligenceResult>(
    relations.intelligence?.result,
  );
  const studentName = text(relations.profile?.display_name, "Student");
  const events: CaseEvent[] = (relations.events ?? [])
    .map((event) => ({
      id: text(event.id),
      at: text(event.at),
      title: text(event.title),
      explanation: text(event.explanation),
      actor: text(event.actor_type, "System") as CaseEvent["actor"],
      audit: jsonObject<CaseEvent["audit"]>(event.details),
    }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const evidence = (relations.evidence ?? []).map((item) => ({
    id: text(item.id),
    name: text(item.name),
    type: text(item.mime_type),
    size: Number(item.size_bytes ?? 0),
    by: "Student",
    at: text(item.created_at),
  }));
  const responses = [...(relations.responses ?? [])]
    .sort(
      (a, b) =>
        Date.parse(text(a.created_at)) - Date.parse(text(b.created_at)),
    )
    .map((response) => ({
      id: text(response.id),
      at: text(response.created_at),
      text: text(response.response_text),
      requestEventId: text(response.request_event_id) || undefined,
      evidence: Array.isArray(response.evidence)
        ? (response.evidence as Row[]).map((item) => ({
            id: text(item.id),
            name: text(item.name),
            type: text(item.type),
            size: Number(item.size ?? 0),
          }))
        : [],
    }));
  const summary =
    jsonObject<ComplaintQueueItem["summary"]>(row.summary) ??
    (intelligence
      ? {
          text: intelligence.summary,
          source: intelligence.source,
          suggestion: "Review the complaint and verify details before acting.",
          reason: intelligence.urgencyReason,
        }
      : {
          text: "Analysis is in progress.",
          source: "Pending analysis",
          suggestion: "Review the complaint and verify supporting details.",
          reason: "No analysis result has been recorded.",
        });
  const record: SharedComplaintRecord = {
    id: text(row.id),
    studentId: text(row.student_id),
    institution: text(row.institution),
    title: text(row.title),
    category: text(row.category, "Other"),
    status: text(row.status, "Submitted") as ComplaintQueueItem["status"],
    updatedAt: text(row.updated_at),
    submittedAt: text(row.submitted_at),
    dueAt: text(row.due_at),
    description: text(row.description),
    priority: text(row.priority, "Medium") as ComplaintQueueItem["priority"],
    cellId: text(row.cell_id, "student"),
    student: {
      name: studentName,
      incidentDate: text(row.incident_date),
      contacted: row.contacted ? "Yes" : "No",
    },
    summary,
    evidence,
    events,
    studentResponses: responses,
    similar: [],
    incidentDate: text(row.incident_date),
    contacted: row.contacted ? "yes" : "no",
    contactDate: text(row.contact_date),
    response: text(row.contact_response),
    intelligence,
    recommendedCellId:
      row.recommended_cell_id === null
        ? null
        : text(row.recommended_cell_id) || null,
    routingStatus: text(row.routing_status, "pending") as SharedComplaintRecord["routingStatus"],
    routedAt: text(row.routed_at) || undefined,
    overriddenByOfficer: row.overridden_by_officer === true,
    request: jsonObject(row.request),
    resolution: jsonObject(row.resolution),
    escalationReason: text(row.escalation_reason) || undefined,
    institutionResponse: jsonObject(row.institution_response),
    trackingResponse: responses.at(-1),
  };
  return record;
}
