import test from "node:test";
import assert from "node:assert/strict";
import {
  applySharedOfficerAction,
  attachComplaintIntelligence,
  createSharedComplaintRecord,
  recordStudentResponse,
  toStudentComplaint,
} from "../src/lib/complaint-store.ts";
import { classifyComplaintFallback } from "../src/lib/intelligence/fallback.ts";
import { getTracking } from "../src/lib/complaint-tracking.ts";
import {
  defaultQueueFilters,
  filterQueue,
} from "../src/lib/officer-model.ts";

const draft = {
  institution: { name: "Demo Institute" },
  title: "College refund is delayed",
  description: "The college has not refunded the admission fee after cancellation.",
  category: "",
  incidentDate: "2026-10-20",
  contacted: "yes",
  contactDate: "2026-10-21",
  response: "I have contacted the office twice.",
  evidence: [],
};
const analyzedAt = "2026-10-24T10:00:00.000Z";

test("submission, fallback routing and officer override stay in one shared record", () => {
  const submitted = createSharedComplaintRecord(
    draft,
    "GRV-2026-9001",
    analyzedAt,
  );
  const result = classifyComplaintFallback({
    title: draft.title,
    description: draft.description,
    analyzedAt,
  });
  const analyzed = attachComplaintIntelligence(submitted, result);

  assert.equal(analyzed.status, "Routed");
  assert.equal(analyzed.cellId, "finance");
  assert.equal(analyzed.recommendedCellId, "finance");
  assert.equal(toStudentComplaint(analyzed).workflowStatus, "Routed");

  const transferred = applySharedOfficerAction(
    analyzed,
    {
      type: "transfer",
      cellId: "records",
      reason: "The sample case needs a second demo review.",
    },
    analyzedAt,
    "officer-transfer",
  );
  const studentView = toStudentComplaint(transferred);
  assert.equal(transferred.cellId, "records");
  assert.equal(transferred.recommendedCellId, "finance");
  assert.equal(transferred.overriddenByOfficer, true);
  assert.deepEqual(transferred.intelligence, analyzed.intelligence);
  assert.equal(transferred.category, analyzed.category);
  assert.equal(studentView.currentCellId, "records");
  assert.equal(studentView.events.at(-1).id, "officer-transfer");
});

test("Other complaints remain in the manual review queue", () => {
  const submitted = createSharedComplaintRecord(
    { ...draft, title: "Please help", description: "Nothing is working." },
    "GRV-2026-9002",
    analyzedAt,
  );
  const result = classifyComplaintFallback({
    title: "Please help",
    description: "Nothing is working.",
    analyzedAt,
  });
  const analyzed = attachComplaintIntelligence(submitted, result);

  assert.equal(analyzed.intelligence.category, "Other");
  assert.equal(analyzed.intelligence.needsManualReview, true);
  assert.equal(analyzed.recommendedCellId, null);
  assert.equal(analyzed.cellId, "student");
  assert.equal(analyzed.routingStatus, "manual-review");
  const student = toStudentComplaint(analyzed);
  assert.equal(student.routingStatus, "manual-review");
  const tracking = getTracking(student, student);
  assert.equal(tracking.owner.cell, "Manual review queue");
  assert.equal(tracking.owner.officer, null);
  assert.equal(filterQueue([analyzed], defaultQueueFilters).length, 0);
  assert.equal(
    filterQueue([analyzed], { ...defaultQueueFilters, scope: "all" }).length,
    1,
  );
});

test("student response updates the shared workflow and case history", () => {
  const submitted = createSharedComplaintRecord(
    draft,
    "GRV-2026-9003",
    analyzedAt,
  );
  const analyzed = attachComplaintIntelligence(
    submitted,
    classifyComplaintFallback({
      title: draft.title,
      description: draft.description,
      analyzedAt,
    }),
  );
  const response = {
    id: "student-response",
    at: "2026-10-24T11:00:00.000Z",
    text: "The office acknowledged my latest request.",
    evidence: [],
  };
  const updated = recordStudentResponse(analyzed, response);
  const studentView = toStudentComplaint(updated);

  assert.equal(updated.status, "Officer Review");
  assert.equal(updated.trackingResponse, response);
  assert.equal(studentView.workflowStatus, "Officer Review");
  assert.equal(studentView.trackingResponse.id, response.id);
  assert.equal(studentView.events.at(-1).id, response.id);
});

test("late analysis cannot overwrite an officer transfer or make the audit trail non-chronological", () => {
  const submitted = createSharedComplaintRecord(
    draft,
    "GRV-2026-9004",
    "2026-10-24T10:00:00.000Z",
  );
  const transferred = applySharedOfficerAction(
    submitted,
    {
      type: "transfer",
      cellId: "records",
      reason: "A demo officer transferred the pending complaint for review.",
    },
    "2026-10-24T10:02:00.000Z",
    "transfer-before-analysis",
  );
  const result = classifyComplaintFallback({
    title: draft.title,
    description: draft.description,
    analyzedAt: "2026-10-24T10:01:00.000Z",
  });
  const analyzed = attachComplaintIntelligence(transferred, result);

  assert.equal(analyzed.status, "Submitted");
  assert.equal(analyzed.cellId, "records");
  assert.equal(analyzed.recommendedCellId, "finance");
  assert.equal(analyzed.overriddenByOfficer, true);
  assert.deepEqual(analyzed.events.map((event) => event.title), [
    "Complaint submitted",
    "Analysis completed",
    "Fallback rules used",
    "Routed to demo cell",
    "Case transferred",
  ]);
  assert.equal(
    analyzed.events[1].id,
    `GRV-2026-9004-analysis-${Date.parse("2026-10-24T10:01:00.000Z")}`,
  );
  assert.ok(
    analyzed.events.every(
      (event, index) =>
        index === 0 ||
        Date.parse(event.at) >= Date.parse(analyzed.events[index - 1].at),
    ),
  );
  assert.equal(new Set(analyzed.events.map((event) => event.id)).size, analyzed.events.length);
});

test("officer actions project their current status, owner and resolution to student tracking", () => {
  const submitted = createSharedComplaintRecord(
    draft,
    "GRV-2026-9005",
    analyzedAt,
  );
  const analyzed = attachComplaintIntelligence(
    submitted,
    classifyComplaintFallback({
      title: draft.title,
      description: draft.description,
      analyzedAt,
    }),
  );
  const actions = [
    {
      type: "request",
      recipient: "Student",
      text: "Please provide the sample acknowledgement for this complaint.",
      dueDate: "",
      expectedStatus: "Student Action Required",
    },
    {
      type: "status",
      status: "Institution Response Requested",
      note: "A sample institution response is pending for review.",
      expectedStatus: "Institution Response Requested",
    },
    {
      type: "transfer",
      cellId: "records",
      reason: "The demo officer is transferring the case for review.",
      expectedStatus: "Routed",
    },
    {
      type: "escalate",
      reason: "The demo response window elapsed without a response.",
      expectedStatus: "Escalated",
    },
    {
      type: "resolve",
      summary: "The demo refund outcome was documented.",
      action: "The sample receipt was reviewed and the outcome recorded.",
      reference: "DEMO-9005",
      expectedStatus: "Resolved",
    },
  ];

  for (const [index, { expectedStatus, ...action }] of actions.entries()) {
    const updated = applySharedOfficerAction(
      analyzed,
      action,
      `2026-10-24T10:${String(10 + index).padStart(2, "0")}:00.000Z`,
      `tracking-action-${index}`,
    );
    const student = toStudentComplaint(updated);
    const tracking = getTracking(student, student);

    assert.equal(tracking.status, expectedStatus);
    assert.equal(tracking.events.at(-1).id, `tracking-action-${index}`);
    if (action.type === "request") {
      assert.equal(tracking.request.dueAt, "");
      assert.equal(tracking.owner.officer, null);
    }
    if (action.type === "transfer")
      assert.equal(tracking.owner.cell, "Demo Academic Records Cell");
    if (action.type === "resolve") {
      assert.equal(tracking.resolution.summary, action.summary);
      assert.equal(tracking.resolution.reference, action.reference);
    }
    assert.equal(
      new Set(tracking.events.map((event) => event.id)).size,
      tracking.events.length,
    );
    assert.ok(
      tracking.events.every(
        (event, eventIndex) =>
          eventIndex === 0 ||
          Date.parse(event.at) >= Date.parse(tracking.events[eventIndex - 1].at),
      ),
    );
  }
});

test("duplicate response and event IDs are rejected", () => {
  const submitted = createSharedComplaintRecord(
    draft,
    "GRV-2026-9006",
    analyzedAt,
  );
  const response = {
    id: "same-response",
    at: analyzedAt,
    text: "The office acknowledged my latest request.",
    evidence: [],
  };
  const responded = recordStudentResponse(submitted, response);
  assert.throws(
    () => recordStudentResponse(responded, response),
    /already been recorded/,
  );
  assert.throws(
    () =>
      applySharedOfficerAction(
        responded,
        {
          type: "escalate",
          reason: "The demo response window elapsed without a response.",
        },
        "2026-10-24T11:00:00.000Z",
        "same-response",
      ),
    /Duplicate complaint event ID/,
  );
});

test("medium confidence keeps category routing but explicitly recommends officer review", () => {
  const submitted = createSharedComplaintRecord(
    draft,
    "GRV-2026-9007",
    analyzedAt,
  );
  const fallback = classifyComplaintFallback({
    title: draft.title,
    description: draft.description,
    analyzedAt,
  });
  const intelligence = {
    ...fallback,
    confidence: 0.7,
    reviewRecommended: true,
    routingReason: `${fallback.routingReason} Confidence is 0.60–0.79; officer review is recommended.`,
  };
  const routed = attachComplaintIntelligence(submitted, intelligence);
  const student = toStudentComplaint(routed);

  assert.equal(routed.status, "Routed");
  assert.equal(routed.cellId, "finance");
  assert.equal(student.intelligence.reviewRecommended, true);
  assert.equal(student.intelligence.confidence, 0.7);
});

test("a new student information request clears the previous response without deleting its history", () => {
  const submitted = createSharedComplaintRecord(
    draft,
    "GRV-2026-9008",
    analyzedAt,
  );
  const response = {
    id: "first-response",
    at: "2026-10-24T10:01:00.000Z",
    text: "The office acknowledged my latest request.",
    evidence: [],
  };
  const responded = recordStudentResponse(submitted, response);
  const requestedAgain = applySharedOfficerAction(
    responded,
    {
      type: "request",
      recipient: "Student",
      text: "Please provide the sample acknowledgement for this complaint.",
      dueDate: "",
    },
    "2026-10-24T10:02:00.000Z",
    "second-request",
  );
  const student = toStudentComplaint(requestedAgain);
  const tracking = getTracking(student, student);

  assert.equal(student.trackingResponse, undefined);
  assert.equal(tracking.status, "Student Action Required");
  assert.equal(tracking.request.prompt, "Please provide the sample acknowledgement for this complaint.");
  assert.ok(tracking.events.some((event) => event.id === response.id));
  assert.equal(tracking.events.at(-1).id, "second-request");
});
