import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCommandCenterMetrics,
  filterCommandCenterCases,
} from "../src/lib/sla/analytics.ts";
import { prototypeSlaPolicy } from "../src/lib/sla/policy.ts";
import { calculateSla } from "../src/lib/sla/sla.ts";

const asOf = "2026-10-24T10:00:00+05:30";
const HOUR = 60 * 60 * 1000;

function record(overrides = {}) {
  return {
    id: "case-1",
    title: "Admission refund is pending",
    institution: "Example Institute",
    category: "Fees / Refund",
    status: "Officer Review",
    updatedAt: "2026-10-23T10:00:00+05:30",
    priority: "High",
    cellId: "finance",
    submittedAt: "2026-10-22T10:00:00+05:30",
    dueAt: "2026-10-24T10:00:00+05:30",
    events: [],
    description:
      "A fictional admission fee refund remains pending after cancellation. Please confirm the expected processing date.",
    student: { name: "Demo Student", incidentDate: "", contacted: "No" },
    summary: {
      text: "Fictional case summary.",
      source: "Demo",
      suggestion: "Review the fictional request.",
      reason: "Prototype only.",
    },
    evidence: [],
    similar: [],
    ...overrides,
  };
}

test("priority targets derive stable deadlines, and explicit deadlines take precedence", () => {
  for (const [priority, hours] of Object.entries(
    prototypeSlaPolicy.targetHours,
  )) {
    const item = record({
      priority,
      submittedAt: "2026-10-20T10:00:00+05:30",
      dueAt: "",
    });
    const result = calculateSla(item, asOf);
    assert.equal(result.targetHours, hours);
    assert.equal(
      result.deadlineAt,
      new Date(Date.parse(item.submittedAt) + hours * HOUR).toISOString(),
    );
  }
  const explicit = calculateSla(record(), asOf);
  assert.equal(explicit.deadlineAt, "2026-10-24T04:30:00.000Z");
});

test("due-soon threshold is one quarter of the priority target", () => {
  const dueSoon = calculateSla(
    record({ dueAt: "2026-10-24T22:00:00+05:30" }),
    asOf,
  );
  assert.equal(dueSoon.state, "Due Soon");
  assert.equal(dueSoon.remainingMs, 12 * HOUR);
  assert.equal(calculateSla(record(), asOf).state, "Due Soon");
  assert.equal(
    calculateSla(record({ dueAt: "2026-10-25T10:00:00+05:30" }), asOf).state,
    "Normal",
  );
});

test("student-information requests pause and resume the officer deadline clock", () => {
  const requestAt = "2026-10-23T10:00:00+05:30";
  const waiting = calculateSla(
    record({
      status: "Student Action Required",
      request: { prompt: "Provide a receipt.", dueAt: "2026-10-28T10:00:00Z" },
      events: [
        {
          id: "request",
          at: requestAt,
          title: "Information requested from student",
          explanation: "Demo request.",
          actor: "Demo Officer",
        },
      ],
    }),
    asOf,
  );
  assert.equal(waiting.state, "Paused");
  assert.equal(waiting.paused, true);
  assert.equal(waiting.pausedMs, 24 * HOUR);
  assert.equal(waiting.remainingMs, 24 * HOUR);
  assert.equal(waiting.deadlineAt, "2026-10-25T04:30:00.000Z");

  const resumed = calculateSla(
    record({
      status: "Officer Review",
      events: [
        {
          id: "request",
          at: requestAt,
          title: "Information requested from student",
          explanation: "Demo request.",
          actor: "Demo Officer",
        },
        {
          id: "response",
          at: "2026-10-24T09:00:00+05:30",
          title: "Student response recorded locally",
          explanation: "Local demo response.",
          actor: "Student",
        },
      ],
    }),
    asOf,
  );
  assert.equal(resumed.state, "Normal");
  assert.equal(resumed.paused, false);
  assert.equal(resumed.pausedMs, 23 * HOUR);
  assert.equal(resumed.remainingMs, 23 * HOUR);
});

test("escalation is recommended only after overdue grace; it never changes status", () => {
  const overdue = record({
    dueAt: "2026-10-23T10:00:00+05:30",
  });
  const overdueResult = calculateSla(overdue, asOf);
  assert.equal(overdueResult.state, "Overdue");
  assert.equal(overdueResult.escalationRecommended, true);
  assert.equal(overdue.status, "Officer Review");
  assert.equal(
    calculateSla(
      record({ dueAt: "2026-10-24T11:00:00+05:30" }),
      asOf,
    ).escalationRecommended,
    false,
  );
  assert.equal(
    calculateSla(
      record({ status: "Escalated", dueAt: "2026-10-20T10:00:00+05:30" }),
      asOf,
    ).escalationRecommended,
    false,
  );
  assert.equal(
    calculateSla(
      record({
        status: "Resolved",
        dueAt: "2026-10-20T10:00:00+05:30",
      }),
      asOf,
    ).state,
    "Resolved",
  );
});

test("invalid and absent dates are unscheduled without throwing", () => {
  assert.equal(
    calculateSla(record({ submittedAt: "bad date", dueAt: "" }), asOf).state,
    "Not scheduled",
  );
  assert.equal(
    calculateSla(record(), "invalid clock").state,
    "Not scheduled",
  );
  assert.equal(
    calculateSla(record({ priority: "Unknown" }), asOf).state,
    "Not scheduled",
  );
});

test("command-center analytics deduplicate by latest update and apply all filters", () => {
  const earlier = record({
    category: "Fees / Refund",
    updatedAt: "2026-10-22T10:00:00+05:30",
  });
  const current = record({
    category: "Student Records",
    updatedAt: "2026-10-23T10:00:00+05:30",
    dueAt: "2026-10-25T10:00:00+05:30",
    status: "Resolved",
    resolution: {
      at: "2026-10-23T06:00:00+05:30",
      summary: "Recorded fictional outcome.",
    },
  });
  const records = [earlier, current, record({ id: "outside", submittedAt: "2026-06-01T10:00:00Z" })];
  const metrics = calculateCommandCenterMetrics(records, asOf, 30);
  assert.equal(metrics.resolved, 1);
  assert.deepEqual(metrics.categories, [{ category: "Student Records", count: 1 }]);
  assert.equal(metrics.averageResolutionHours, 20);
  assert.equal(
    filterCommandCenterCases(records, asOf, {
      windowDays: 30,
      category: "Student Records",
      institution: "Example Institute",
      sla: "Resolved",
    }).length,
    1,
  );
  assert.equal(
    filterCommandCenterCases(records, asOf, {
      windowDays: 7,
      category: "Fees / Refund",
      institution: "Example Institute",
      sla: "all",
    }).length,
    0,
  );
});

test("repeated refund cluster remains visible to command-center pattern analytics", () => {
  const cases = [
    record(),
    record({
      id: "case-2",
      studentId: "student-2",
      title: "Fee refund delayed after cancellation",
    }),
    record({
      id: "case-3",
      studentId: "student-3",
      title: "Admission refund pending",
    }),
  ];
  const metrics = calculateCommandCenterMetrics(cases, asOf, 30);
  assert.ok(
    metrics.patterns.some(
      ({ cluster }) =>
        cluster.label.toLowerCase().includes("refund") &&
        cluster.complaintCount >= 2,
    ),
  );
});
