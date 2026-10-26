import type { Complaint } from "./demo-student";
import type { LocalComplaint, EvidenceFile } from "./complaint-flow";
import type { ComplaintIntelligenceResult } from "./intelligence/types";
import { officerCells } from "./officer-model.ts";
import { calculateSla, formatDuration } from "./sla/sla.ts";
export const lifecycleStatuses = [
  "Submitted",
  "Initial Review",
  "Routed",
  "Assigned",
  "Officer Review",
  "Institution Response Requested",
  "Student Action Required",
  "Escalated",
  "Resolved",
  "Closed",
] as const;
export type LifecycleStatus = (typeof lifecycleStatuses)[number];
export type CaseActor =
  "Student" | "System" | "Demo Cell" | "Demo Officer" | "Demo Institution";
export interface CaseEvent {
  id: string;
  at: string;
  title: string;
  explanation: string;
  actor: CaseActor;
  audit?: { actor_name?: string; actor_role?: string; actor_cell?: string | null; from_cell?: string; to_cell?: string; reason?: string };
}
export interface CaseOwner {
  cell: string;
  officer: string | null;
}
export type SlaState =
  | "Normal"
  | "Due Soon"
  | "Overdue"
  | "Paused"
  | "Escalated"
  | "Complete"
  | "Not scheduled";
export interface CaseSla {
  state: SlaState;
  dueAt: string | null;
  window: string;
  remaining: string;
  paused?: boolean;
}
export interface RequestedAction {
  prompt: string;
  dueAt: string;
}
export interface Resolution {
  at: string;
  summary: string;
  action: string;
}
export type EvidenceMetadata = Omit<EvidenceFile, "file">;
export interface CaseResponse {
  id: string;
  at: string;
  text: string;
  evidence: EvidenceMetadata[];
  requestEventId?: string;
}
export interface TrackingSession {
  response?: CaseResponse;
  feedback?: "yes" | "no";
}
export interface TrackingCase {
  status: LifecycleStatus;
  submittedAt: string;
  owner: CaseOwner | null;
  sla: CaseSla;
  events: CaseEvent[];
  description: string;
  incidentDate: string;
  contacted: string;
  evidence: EvidenceMetadata[];
  request?: RequestedAction;
  resolution?: Resolution;
  response?: CaseResponse;
  local: boolean;
  intelligence?: ComplaintIntelligenceResult;
  routingStatus?: "pending" | "routed" | "manual-review";
  currentCellId?: string | null;
}
export const stages = [
  "Complaint Submitted",
  "Initial Review",
  "Correct Cell Identified",
  "Assigned to Authority",
  "Officer Review",
  "Institution Response",
  "Resolution",
];
const stageByStatus: Record<LifecycleStatus, number> = {
  Submitted: 0,
  "Initial Review": 1,
  Routed: 2,
  Assigned: 3,
  "Officer Review": 4,
  "Institution Response Requested": 5,
  "Student Action Required": 4,
  Escalated: 4,
  Resolved: 6,
  Closed: 6,
};
export function stageState(status: LifecycleStatus, index: number) {
  const current = stageByStatus[status];
  return index < current ||
    ((status === "Resolved" || status === "Closed") && index === 6)
    ? "completed"
    : index === current
      ? "current"
      : "pending";
}
// Fixed fictional scenario clock: never presented as live policy or a live countdown.
export const DEMO_AS_OF = "2026-10-24T10:00:00+05:30";
export function demoSla(
  dueAt: string | null,
  escalated = false,
  complete = false,
): CaseSla {
  if (complete)
    return {
      state: "Complete",
      dueAt: null,
      window: "Demo response window completed",
      remaining: "No response pending",
      paused: false,
    };
  if (!dueAt)
    return {
      state: "Not scheduled",
      dueAt: null,
      window: "No response window configured",
      remaining: "Not scheduled in this prototype",
      paused: false,
    };
  const days = Math.ceil(
    (new Date(dueAt).getTime() - new Date(DEMO_AS_OF).getTime()) / 86400000,
  );
  return {
    state: escalated
      ? "Escalated"
      : days < 0
        ? "Overdue"
        : days <= 1
          ? "Due Soon"
          : "Normal",
    dueAt,
    window: "Illustrative target: 5 calendar days",
    remaining:
      days < 0
        ? `${Math.abs(days)} days overdue`
        : days === 0
          ? "Due today"
          : `${days} ${days === 1 ? "day" : "days"} remaining`,
    paused: false,
  };
}
function localCaseSla(local: LocalComplaint): CaseSla {
  if (local.resolution || ["Resolved", "Closed"].includes(local.workflowStatus ?? ""))
    return demoSla(local.dueAt ?? null, false, true);
  if (!local.dueAt) return demoSla(null);
  const calculation = calculateSla(
    {
      id: local.id,
      submittedAt: local.submittedAt,
      dueAt: local.dueAt,
      priority: local.priority ?? "Medium",
      status: local.workflowStatus ?? "Submitted",
      events: local.events ?? [],
      resolution: local.resolution,
      request: local.request,
      institution: local.institution,
      category: local.category,
      title: local.title,
      description: local.description,
      cellId: local.currentCellId ?? "student",
    },
    DEMO_AS_OF,
  );
  const state: SlaState =
    calculation.state === "Resolved" ? "Complete" : calculation.state;
  return {
    state,
    dueAt: calculation.deadlineAt,
    window: `Prototype target: ${calculation.targetHours} hours`,
    remaining:
      calculation.state === "Paused"
        ? "Paused while waiting for your information"
        : calculation.state === "Resolved"
          ? "Response window completed"
          : formatDuration(calculation.remainingMs),
    paused: calculation.paused,
  };
}
const owner = {
  cell: "Demo Student Grievance Cell",
  officer: "Demo Officer A. Mehra",
};
const times = [
  "2026-10-15T10:22:00+05:30",
  "2026-10-15T10:25:00+05:30",
  "2026-10-15T10:29:00+05:30",
  "2026-10-16T09:00:00+05:30",
  "2026-10-17T11:00:00+05:30",
  "2026-10-17T14:00:00+05:30",
  "2026-10-18T09:00:00+05:30",
];
const explanations = [
  "A fictional complaint was recorded for this demonstration.",
  "The demo intake team checked the available context.",
  "A fictional responsibility path was selected; this is not an official AICTE mapping.",
  "The case was allocated to a fictional officer.",
  "The fictional officer began reviewing the case documents.",
  "A response was requested from the fictional institution.",
  "A fictional outcome was recorded and shared.",
];
function events(count: number): CaseEvent[] {
  return stages
    .slice(0, count)
    .map((title, i) => ({
      id: `stage-${i}`,
      at: times[i],
      title,
      explanation: explanations[i],
      actor:
        i === 0
          ? "Student"
          : i < 3
            ? "System"
            : i === 3
              ? "Demo Cell"
              : "Demo Officer",
    }));
}
const receipt: EvidenceMetadata = {
  id: "sample-receipt",
  name: "sample-fee-receipt.pdf",
  type: "application/pdf",
  size: 146432,
};
const base = {
  submittedAt: times[0],
  owner,
  description:
    "This is a fictional example complaint. I contacted the institution about the issue and requested a written explanation and a clear next step. The matter remains unresolved in this sample scenario.",
  incidentDate: "2026-10-12",
  contacted: "Yes — contacted on 14 Oct 2026; acknowledgement received.",
  evidence: [receipt],
  local: false,
};
export const demoTracking: Record<string, TrackingCase> = {
  "GRV-2026-1042": {
    ...base,
    status: "Officer Review",
    submittedAt: "2026-10-22T10:00:00+05:30",
    sla: demoSla("2026-10-27T10:00:00+05:30"),
    events: events(5).map((e, i) => ({
      ...e,
      at:
        i < 4
          ? `2026-10-22T${["10:00", "10:15", "10:30", "11:00"][i]}:00+05:30`
          : "2026-10-23T08:00:00+05:30",
    })),
    description:
      "I cancelled my admission and requested a refund. The fictional institution acknowledged the request, but the refund has not appeared in the sample account. I am requesting confirmation of the amount and processing date.",
  },
  "GRV-2026-1018": {
    ...base,
    status: "Student Action Required",
    submittedAt: "2026-10-20T10:00:00+05:30",
    sla: demoSla("2026-10-25T10:00:00+05:30"),
    events: [
      ...events(5).map((e, i) => ({
        ...e,
        at: `2026-10-20T${["10:00", "10:15", "10:30", "11:00", "12:00"][i]}:00+05:30`,
      })),
      {
        id: "request",
        at: "2026-10-22T14:30:00+05:30",
        title: "Additional information requested",
        explanation:
          "Please provide the acknowledgement for your original certificate return request.",
        actor: "Demo Officer",
      },
    ],
    request: {
      prompt:
        "Please provide the acknowledgement for your certificate return request, or explain when and how you contacted the institution.",
      dueAt: "2026-10-28T17:00:00+05:30",
    },
    description:
      "My original certificates have not been returned after withdrawal from this fictional college. I requested their return and would like confirmation of when I can collect them.",
    evidence: [],
  },
  "GRV-2026-1007": {
    ...base,
    status: "Assigned",
    sla: demoSla("2026-10-20T10:00:00+05:30"),
    events: [
      ...events(4),
      {
        id: "awaiting",
        at: "2026-10-21T10:00:00+05:30",
        title: "Awaiting officer review",
        explanation:
          "The illustrative response deadline has passed. No escalation is recorded for this sample.",
        actor: "System",
      },
    ],
    description:
      "The sample examination fee includes an additional charge. I would like an itemised explanation of this charge and its basis.",
  },
  "GRV-2026-1001": {
    ...base,
    status: "Submitted",
    submittedAt: "2026-10-20T11:00:00+05:30",
    owner: null,
    sla: demoSla(null),
    events: [{ ...events(1)[0], at: "2026-10-20T11:00:00+05:30" }],
    description:
      "This fictional request asks for accessible laboratory facilities and a clear plan for improving access.",
    evidence: [],
    contacted: "No",
    incidentDate: "",
  },
  "GRV-2026-0994": {
    ...base,
    status: "Resolved",
    sla: demoSla(null, false, true),
    events: events(7),
    description:
      "The scholarship amount was not credited in this fictional case. I requested confirmation of payment and a transaction reference.",
    resolution: {
      at: "2026-10-18T09:00:00+05:30",
      summary:
        "The demo institution confirmed scholarship processing and supplied a fictional transaction reference.",
      action:
        "Payment confirmation recorded; the student was given a written explanation in this sample scenario.",
    },
  },
  "GRV-2026-0987": {
    ...base,
    status: "Escalated",
    owner: {
      cell: "Demo Escalation Review Cell",
      officer: "Demo Officer N. Rao",
    },
    sla: demoSla("2026-10-20T10:00:00+05:30", true),
    events: [
      ...events(5),
      {
        id: "escalation",
        at: "2026-10-23T15:00:00+05:30",
        title: "Escalated to the next review level",
        explanation:
          "The demo deadline was exceeded. A fictional escalation reviewer now owns the case.",
        actor: "Demo Cell",
      },
    ],
    description:
      "This fictional complaint requests clarification about a withheld course completion record. The initial review deadline passed without a recorded outcome.",
  },
};
export function getTracking(
  complaint: Complaint,
  local?: LocalComplaint,
  session?: TrackingSession,
): TrackingCase {
  const data = local
    ? {
        status: local.workflowStatus ?? ("Submitted" as const),
        submittedAt: local.submittedAt,
        owner: local.currentCellId
          ? {
              cell:
                local.routingStatus === "manual-review" &&
                !local.overriddenByOfficer
                  ? "Manual review queue"
                  : (officerCells.find(
                      (cell) => cell.id === local.currentCellId,
                    )?.name ?? "Demo review cell"),
              officer: null,
            }
          : null,
        sla: localCaseSla(local),
        events: local.events ?? [
          {
            id: "local-submitted",
            at: local.submittedAt,
            title: "Complaint submitted locally",
            explanation:
              "Recorded in browser memory only.",
            actor: "Student" as const,
          },
        ],
        description: local.description,
        incidentDate: local.incidentDate,
        contacted:
          local.contacted === "yes"
            ? `Yes${local.contactDate ? ` — ${local.contactDate}` : ""}${local.response ? `. ${local.response}` : ""}`
            : "No",
        evidence: local.evidence,
        request: local.request,
        resolution: local.resolution,
        response: local.trackingResponse,
        intelligence: local.intelligence,
        routingStatus: local.routingStatus,
        currentCellId: local.currentCellId,
        local: true,
      }
    : demoTracking[complaint.id];
  if (!data) throw new Error("Missing demo tracking fixture");
  if (local?.workflowStatus) return data;
  if (!session?.response) return data;
  return {
    ...data,
    status: "Officer Review",
    request: undefined,
    response: session.response,
    events: [
      ...data.events,
      {
        id: session.response.id,
        at: session.response.at,
        title: "Demo response recorded locally",
        explanation:
          "The student added information in this browser. No document was uploaded and no officer was notified.",
        actor: "Student",
      },
    ],
  };
}
export function nextMessage(data: TrackingCase) {
  if (data.response)
    return "Your demo response is recorded locally. The sample case is awaiting officer review. No real officer has received it.";
  if (data.request)
    return "Additional information is needed from you. Review the request below and add a demo response.";
  if (data.resolution)
    return "An outcome has been recorded for this fictional case. Review the resolution and optionally share local demo feedback.";
  if (data.status === "Escalated")
    return "The response deadline was exceeded in this demo. The next review level owns the case. No action is required from you.";
  if (data.status === "Submitted")
    return "Your complaint is recorded. Initial review would come next; review and routing are not running in this prototype. No action is required from you.";
  return "Your complaint is awaiting or undergoing officer review in this demo. No action is required from you right now.";
}
export function responseError(text: string, fileCount: number) {
  return text.length > 1500
    ? "Keep your response to 1,500 characters or fewer."
    : text.trim().length < 10 && !fileCount
      ? "Add a response of at least 10 characters or select supporting evidence."
      : null;
}
export function formatEventTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}
