import type { Complaint } from "./demo-student";
import type {
  LifecycleStatus,
  CaseEvent,
  CaseResponse,
  Resolution,
  EvidenceMetadata,
  RequestedAction,
} from "./complaint-tracking";
import { calculateSla, formatDuration } from "./sla/sla.ts";
export type ComplaintPriority = "Low" | "Medium" | "High" | "Critical";
export interface OfficerCell {
  id: string;
  name: string;
}
export interface Officer {
  id: string;
  name: string;
  initials: string;
  cellId: string;
}
export interface CaseSummary {
  text: string;
  source: string;
  suggestion: string;
  reason: string;
}
export interface SimilarComplaint {
  id: string;
  label: "High" | "Medium";
}
export interface InstitutionHistory {
  institution: string;
  total: number;
  open: number;
  resolved: number;
  topCategory: string;
  pattern: string;
}
export type OfficerSlaState =
  | "Paused"
  | "On Track"
  | "Due Soon"
  | "Overdue"
  | "Escalated"
  | "Complete"
  | "Not scheduled";
export interface OfficerEvidence extends EvidenceMetadata {
  by: string;
  at: string;
}
export interface OfficerResolution extends Resolution {
  reference?: string;
}
export interface ComplaintQueueItem extends Omit<Complaint, "status"> {
  studentId?: string;
  status: LifecycleStatus;
  priority: ComplaintPriority;
  cellId: string;
  submittedAt: string;
  dueAt: string;
  description: string;
  student: { name: string; incidentDate: string; contacted: string };
  summary: CaseSummary;
  evidence: OfficerEvidence[];
  events: CaseEvent[];
  studentResponses?: CaseResponse[];
  similar: SimilarComplaint[];
  institutionResponse?: { text: string; at: string };
  resolution?: OfficerResolution;
  escalationReason?: string;
  request?: RequestedAction;
  intelligence?: import("./intelligence/types").ComplaintIntelligenceResult;
  recommendedCellId?: string | null;
  routingStatus?: "pending" | "routed" | "manual-review";
  routedAt?: string;
  overriddenByOfficer?: boolean;
}
export type OfficerAction =
  | {
      type: "request";
      recipient: "Student" | "Institution";
      text: string;
      dueDate: string;
    }
  | {
      type: "status";
      status:
        | "Officer Review"
        | "Student Action Required"
        | "Institution Response Requested";
      note: string;
    }
  | { type: "transfer"; cellId: string; reason: string }
  | { type: "escalate"; reason: string }
  | { type: "resolve"; summary: string; action: string; reference: string };
export type ActionKind = OfficerAction["type"];
export { reviewCells as officerCells } from "./cells.ts";
import { reviewCells as officerCells } from "./cells.ts";
export const demoOfficer: Officer = {
  id: "demo-officer-1",
  name: "Demo Officer A. Mehra",
  initials: "AM",
  cellId: "student",
};
export const priorityRank: Record<ComplaintPriority, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};
export const OFFICER_DEMO_CLOCK = "2026-10-24T10:00:00+05:30";
export const statusLabel = (status: LifecycleStatus) =>
  status === "Student Action Required"
    ? "Awaiting Student"
    : status === "Institution Response Requested"
      ? "Awaiting Institution"
      : status;
export function officerSla(item: ComplaintQueueItem) {
  const result = calculateSla(item, OFFICER_DEMO_CLOCK);
  const days =
    result.remainingMs === null
      ? Number.POSITIVE_INFINITY
      : Math.ceil(result.remainingMs / 86400000);
  const state: OfficerSlaState =
    result.state === "Normal"
      ? "On Track"
      : result.state === "Resolved"
        ? "Complete"
        : result.state;
  return {
    state,
    days,
    deadlineAt: result.deadlineAt,
    targetHours: result.targetHours,
    remainingMs: result.remainingMs,
    paused: result.paused,
    pausedMs: result.pausedMs,
    overdueMs: result.overdueMs,
    escalationRecommended: result.escalationRecommended,
    text:
      result.state === "Resolved"
        ? "Response window completed"
        : result.state === "Not scheduled"
          ? "No response window scheduled"
          : result.state === "Paused"
            ? `Paused while waiting for student · ${formatDuration(result.remainingMs)}`
            : result.state === "Escalated"
              ? "Escalated for review"
              : result.remainingMs !== null && result.remainingMs < 0
                ? formatDuration(result.remainingMs)
                : result.remainingMs !== null &&
                    result.remainingMs < 86400000
                  ? "Due today"
                  : formatDuration(result.remainingMs),
  };
}
export const isOpenCase = (item: ComplaintQueueItem) =>
  !["Resolved", "Closed"].includes(item.status);
export function needsOfficerAction(item: ComplaintQueueItem) {
  return (
    isOpenCase(item) &&
    !["Student Action Required", "Institution Response Requested"].includes(
      item.status,
    )
  );
}
export function officerMetrics(items: ComplaintQueueItem[]) {
  return {
    new: items.filter((c) =>
      ["Submitted", "Initial Review", "Routed", "Assigned"].includes(c.status),
    ).length,
    active: items.filter(isOpenCase).length,
    needsAction: items.filter(needsOfficerAction).length,
    overdue: items.filter(
      (c) => isOpenCase(c) && officerSla(c).state === "Overdue",
    )
      .length,
    resolvedWeek: items.filter(
      (c) =>
        c.resolution &&
        Date.parse(c.resolution.at) >=
          Date.parse("2026-10-18T00:00:00+05:30") &&
        Date.parse(c.resolution.at) < Date.parse("2026-10-25T00:00:00+05:30"),
    ).length,
  };
}
export interface QueueFilters {
  scope: "mine" | "all";
  status: string;
  priority: string;
  category: string;
  sla: string;
  institution: string;
  sort: "newest" | "oldest" | "priority" | "overdue" | "deadline";
}
export const defaultQueueFilters: QueueFilters = {
  scope: "mine",
  status: "all",
  priority: "all",
  category: "all",
  sla: "all",
  institution: "all",
  sort: "priority",
};
export function filterQueue(
  items: ComplaintQueueItem[],
  filters: QueueFilters,
) {
  return items
    .filter(
      (c) =>
        (filters.scope === "all" ||
          (c.cellId === demoOfficer.cellId &&
            (c.routingStatus !== "manual-review" ||
              c.overriddenByOfficer))) &&
        (filters.status === "all" || c.status === filters.status) &&
        (filters.priority === "all" || c.priority === filters.priority) &&
        (filters.category === "all" || c.category === filters.category) &&
        (filters.sla === "all" ||
          officerSla(c).state === filters.sla ||
          (filters.sla === "Normal" && officerSla(c).state === "On Track") ||
          (filters.sla === "Resolved" && officerSla(c).state === "Complete")) &&
        (filters.institution === "all" ||
          c.institution === filters.institution),
    )
    .sort((a, b) => {
      if (filters.sort === "priority")
        return (
          priorityRank[b.priority] - priorityRank[a.priority] ||
          a.submittedAt.localeCompare(b.submittedAt)
        );
      if (filters.sort === "overdue")
        return (
          (isOpenCase(b)
            ? Math.max(0, -(officerSla(b).remainingMs ?? 0))
            : 0) -
            (isOpenCase(a)
              ? Math.max(0, -(officerSla(a).remainingMs ?? 0))
              : 0) ||
          a.id.localeCompare(b.id)
        );
      if (filters.sort === "deadline") {
        const dueA = Date.parse(officerSla(a).deadlineAt ?? "");
        const dueB = Date.parse(officerSla(b).deadlineAt ?? "");
        return (
          Number(!isOpenCase(a)) - Number(!isOpenCase(b)) ||
          (Number.isFinite(dueA) ? dueA : Number.POSITIVE_INFINITY) -
            (Number.isFinite(dueB) ? dueB : Number.POSITIVE_INFINITY) ||
          a.id.localeCompare(b.id)
        );
      }
      return filters.sort === "oldest"
        ? a.submittedAt.localeCompare(b.submittedAt)
        : b.submittedAt.localeCompare(a.submittedAt);
    });
}
export function institutionHistory(
  items: ComplaintQueueItem[],
  institution: string,
): InstitutionHistory {
  const recent = items.filter(
    (c) =>
      c.institution === institution &&
      Date.parse(c.submittedAt) >=
        Date.parse(OFFICER_DEMO_CLOCK) - 90 * 86400000,
  );
  const counts: Record<string, number> = {};
  recent.forEach((c) => (counts[c.category] = (counts[c.category] || 0) + 1));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return {
    institution,
    total: recent.length,
    open: recent.filter(isOpenCase).length,
    resolved: recent.filter((c) => !isOpenCase(c)).length,
    topCategory: top?.[0] || "None",
    pattern:
      top && top[1] > 1
        ? `${top[1]} ${top[0].toLowerCase()} cases in this demo dataset`
        : "No repeated category in this sample",
  };
}
function validDueDate(value: string, today: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= today
  );
}
export function validateOfficerAction(
  item: ComplaintQueueItem,
  action: OfficerAction,
  today: string,
): string | null {
  if (!isOpenCase(item))
    return "This demo case is resolved or closed. Further actions are unavailable.";
  const lengthError = (text: string, label: string) =>
    text.trim().length < 10 || text.length > 2000
      ? `${label} must contain 10–2,000 characters.`
      : null;
  if (action.type === "request") {
    if (!["Student", "Institution"].includes(action.recipient))
      return "Choose a recipient.";
    return (
      lengthError(action.text, "Request") ||
      (action.dueDate && !validDueDate(action.dueDate, today)
        ? "Choose a valid due date today or later."
        : null)
    );
  }
  if (action.type === "status")
    return ![
      "Officer Review",
      "Student Action Required",
      "Institution Response Requested",
    ].includes(action.status)
      ? "Choose a supported status."
      : action.status === item.status
        ? "Choose a different status."
        : lengthError(action.note, "Status note");
  if (action.type === "transfer")
    return !officerCells.some((c) => c.id === action.cellId)
      ? "Choose a demo cell."
      : action.cellId === item.cellId
        ? "Choose a different demo cell."
        : lengthError(action.reason, "Transfer reason");
  if (action.type === "escalate")
    return item.status === "Escalated"
      ? "This case is already escalated."
      : lengthError(action.reason, "Escalation reason");
  return (
    lengthError(action.summary, "Resolution summary") ||
    lengthError(action.action, "Action taken") ||
    (action.reference.length > 120
      ? "Keep the reference to 120 characters or fewer."
      : null)
  );
}
// Pure, immutable transition: the provider keeps the result only in browser memory.
export function applyOfficerAction(
  item: ComplaintQueueItem,
  action: OfficerAction,
  at: string,
  eventId: string,
): ComplaintQueueItem {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at));
  const error = validateOfficerAction(item, action, today);
  if (error) throw new Error(error);
  let title = "",
    explanation = "";
  const next = { ...item, updatedAt: at };
  if (action.type === "request") {
    next.status =
      action.recipient === "Student"
        ? "Student Action Required"
        : "Institution Response Requested";
    title = `Information requested from ${action.recipient.toLowerCase()}`;
    explanation = `${action.text.trim()}${action.dueDate ? ` Requested by ${action.dueDate}.` : ""} Local demo only; no message sent.`;
    if (action.recipient === "Student")
      next.request = {
        prompt: action.text.trim(),
        dueAt: action.dueDate
          ? `${action.dueDate}T17:00:00+05:30`
          : "",
      };
  }
  if (action.type === "status") {
    next.status = action.status;
    title = `Status updated to ${statusLabel(action.status)}`;
    explanation = action.note.trim();
  }
  if (action.type === "transfer") {
    next.cellId = action.cellId;
    title = "Case transferred";
    explanation = `${officerCells.find((c) => c.id === item.cellId)?.name} → ${officerCells.find((c) => c.id === action.cellId)?.name}. ${action.reason.trim()}${item.intelligence ? ` System recommendation remains ${officerCells.find((c) => c.id === item.intelligence?.recommendedCellId)?.name ?? "manual review"}; current officer decision is ${officerCells.find((c) => c.id === action.cellId)?.name}.` : ""}`;
    if (item.intelligence || item.routingStatus === "pending")
      next.overriddenByOfficer = true;
  }
  if (action.type === "escalate") {
    next.status = "Escalated";
    next.escalationReason = action.reason.trim();
    title = "Case escalated";
    explanation = action.reason.trim();
  }
  if (action.type === "resolve") {
    next.status = "Resolved";
    next.resolution = {
      at,
      summary: action.summary.trim(),
      action: action.action.trim(),
      reference: action.reference.trim() || undefined,
    };
    title = "Resolution added";
    explanation = `${action.summary.trim()} Action: ${action.action.trim()}${action.reference.trim() ? ` Reference: ${action.reference.trim()}.` : ""}`;
  }
  next.events = [
    ...item.events,
    { id: eventId, at, title, explanation, actor: "Demo Officer" },
  ];
  return next;
}
