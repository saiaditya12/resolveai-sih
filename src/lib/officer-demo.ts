import { complaints } from "./demo-student";
import { demoTracking } from "./complaint-tracking";
import type { ComplaintQueueItem, ComplaintPriority } from "./officer-model";
const priorities: Record<string, ComplaintPriority> = {
  "GRV-2026-0987": "Critical",
  "GRV-2026-1042": "High",
  "GRV-2026-1018": "Medium",
  "GRV-2026-1007": "High",
  "GRV-2026-1001": "Low",
  "GRV-2026-0994": "Medium",
};
export const officerSeedCases: ComplaintQueueItem[] = complaints.map((c) => {
  const t = demoTracking[c.id];
  return {
    ...c,
    studentId: "demo-student-1",
    status: t.status,
    priority: priorities[c.id],
    cellId: c.status === "Escalated" ? "records" : "student",
    submittedAt: t.submittedAt,
    dueAt: t.sla.dueAt || "2026-10-28T10:00:00+05:30",
    description: t.description,
    student: {
      name: "Demo Student A. Sharma",
      incidentDate: t.incidentDate,
      contacted: t.contacted,
    },
    summary: {
      text:
        c.id === "GRV-2026-1042"
          ? "Student reports a refund pending after admission cancellation. A sample fee receipt is listed; transaction confirmation is missing. Prior contact has not produced a recorded outcome."
          : t.description,
      source: "Prewritten mock intelligence",
      suggestion: c.category.includes("Fees")
        ? "Request payment confirmation and an itemised response from the institution."
        : "Review the original request and ask the appropriate party for the missing context.",
      reason: c.category.includes("Fees")
        ? "The sample case lacks financial confirmation; related fee cases are present in this fictional dataset."
        : "The written complaint alone does not establish an outcome. Verify supporting details before deciding.",
    },
    evidence: t.evidence.map((e) => ({
      ...e,
      by: "Demo Student",
      at: t.submittedAt,
    })),
    events: t.events,
    similar: [],
    resolution: t.resolution,
    escalationReason:
      c.status === "Escalated"
        ? "Sample deadline exceeded without a recorded outcome."
        : undefined,
    institutionResponse:
      c.status === "Resolved"
        ? {
            text: "Fictional institution response: payment processing has been confirmed and a sample reference was provided.",
            at: "2026-10-17T16:00:00+05:30",
          }
        : undefined,
  };
});
const source = officerSeedCases.find((c) => c.id === "GRV-2026-1042")!;
for (const [index, title] of [
  "Security deposit refund pending",
  "Refund acknowledgement not issued",
  "Admission cancellation refund clarification",
].entries()) {
  const at = `2026-10-${21 - index}T09:00:00+05:30`;
  officerSeedCases.push({
    ...source,
    id: `GRV-2026-${1101 + index}`,
    studentId: `demo-cluster-student-${index + 1}`,
    student: { ...source.student, name: `Fictional Student ${index + 2}` },
    title,
    status:
      index === 0
        ? "Institution Response Requested"
        : index === 1
          ? "Assigned"
          : "Submitted",
    priority: index === 0 ? "High" : index === 1 ? "Medium" : "Low",
    submittedAt: at,
    updatedAt: at,
    dueAt: `2026-10-${26 - index}T10:00:00+05:30`,
    description: [
      "I cancelled my admission forty days ago and requested the return of my fee and security deposit. The refund is delayed despite a written acknowledgement. Please confirm the processing date for this fictional case.",
      "My admission fee refund has not arrived after cancellation. The fictional institution acknowledged withdrawal, but has not confirmed the refund amount or processing date despite repeated contact.",
      "After cancelling admission, I requested a fee refund several weeks ago. The fictional college acknowledged my request, but payment remains pending. I need confirmation of the amount and processing date.",
    ][index],
    summary: {
      text: `The student reports ${title.toLowerCase()}. This sample case is intended to illustrate a recurring fee-related concern, not a verified institutional pattern.`,
      source: "Prewritten mock intelligence",
      suggestion:
        "Verify the cancellation acknowledgement and ask for the expected processing date.",
      reason:
        "The demo record does not yet establish when the refund will be processed.",
    },
    events: [
      {
        id: "submitted",
        at,
        title: "Complaint submitted",
        explanation:
          "Fictional complaint recorded for the officer workspace demo.",
        actor: "Student",
      },
      ...(index < 2
        ? [
            {
              id: "assigned",
              at,
              title:
                index === 0
                  ? "Institution response requested"
                  : "Assigned to demo cell",
              explanation:
                "Prewritten sample workflow event, not a real request or assignment.",
              actor: "Demo Officer" as const,
            },
          ]
        : []),
    ],
    evidence: [
      {
        id: "ack",
        name: "sample-cancellation-acknowledgement.pdf",
        type: "application/pdf",
        size: 82432,
        by: "Demo Student",
        at,
      },
    ],
    similar: [],
    institutionResponse:
      index === 0
        ? {
            text: "Fictional acknowledgement: the refund request is being checked. No transaction confirmation is included in this sample.",
            at,
          }
        : undefined,
  });
}

officerSeedCases.push(
  {
    ...source,
    id: "GRV-2026-1104",
    studentId: "demo-cluster-student-4",
    student: { ...source.student, name: "Fictional Student 5" },
    title: "Admission refund still pending after cancellation",
    status: "Officer Review",
    priority: "Medium",
    submittedAt: "2026-10-14T09:00:00+05:30",
    updatedAt: "2026-10-14T09:00:00+05:30",
    dueAt: "2026-10-21T10:00:00+05:30",
    description:
      "I cancelled my admission and requested a refund of the fee. The fictional institution acknowledged my request, but payment is still pending. Please confirm the processing date and amount.",
    summary: {
      text: "Fictional sample about an admission refund request.",
      source: "Prewritten mock intelligence",
      suggestion: "Check the sample acknowledgement and payment timeline.",
      reason: "The sample complaint does not establish a payment outcome.",
    },
    events: [
      {
        id: "GRV-2026-1104-submitted",
        at: "2026-10-14T09:00:00+05:30",
        title: "Complaint submitted",
        explanation: "Fictional complaint recorded for the officer demo.",
        actor: "Student",
      },
      {
        id: "GRV-2026-1104-review",
        at: "2026-10-14T10:00:00+05:30",
        title: "Under officer review",
        explanation: "Prewritten sample history; no officer action was taken.",
        actor: "Demo Officer",
      },
    ],
  },
  {
    ...officerSeedCases.find((item) => item.id === "GRV-2026-1001")!,
    id: "GRV-2026-1105",
    studentId: "demo-cluster-student-5",
    student: {
      ...officerSeedCases.find((item) => item.id === "GRV-2026-1001")!.student,
      name: "Fictional Student 6",
    },
    title: "Accessible laboratory ramp plan",
    status: "Assigned",
    priority: "Low",
    submittedAt: "2026-10-14T11:00:00+05:30",
    updatedAt: "2026-10-14T11:00:00+05:30",
    description:
      "This fictional request asks for accessible laboratory facilities and a clear plan for improving access.",
    events: [
      {
        id: "GRV-2026-1105-submitted",
        at: "2026-10-14T11:00:00+05:30",
        title: "Complaint submitted",
        explanation: "Fictional complaint recorded for the officer demo.",
        actor: "Student",
      },
      {
        id: "GRV-2026-1105-assigned",
        at: "2026-10-14T12:00:00+05:30",
        title: "Assigned to demo cell",
        explanation: "Prewritten sample history; no real assignment occurred.",
        actor: "Demo Officer",
      },
    ],
  },
  {
    ...source,
    id: "GRV-2026-1106",
    studentId: "demo-transcript-student",
    institution: source.institution,
    category: "Student Records",
    title: "Transcript download unavailable",
    status: "Submitted",
    priority: "Low",
    submittedAt: "2026-10-22T13:00:00+05:30",
    updatedAt: "2026-10-22T13:00:00+05:30",
    dueAt: "2026-10-29T10:00:00+05:30",
    description:
      "The transcript download is unavailable in the fictional student portal. Please restore access to the academic record for this sample complaint.",
    summary: {
      text: "Fictional sample about access to an academic transcript.",
      source: "Prewritten mock intelligence",
      suggestion: "Review the portal access request.",
      reason: "The sample record does not establish the reason for the issue.",
    },
    student: {
      ...source.student,
      name: "Fictional Student 7",
    },
    evidence: [],
    events: [
      {
        id: "GRV-2026-1106-submitted",
        at: "2026-10-22T13:00:00+05:30",
        title: "Complaint submitted",
        explanation: "Fictional complaint recorded for the officer demo.",
        actor: "Student",
      },
    ],
  },
);
