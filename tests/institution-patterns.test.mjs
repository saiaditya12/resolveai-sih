import test from "node:test";
import assert from "node:assert/strict";
import {
  getInstitutionComplaintHistory,
  getCurrentCaseCluster,
  getInstitutionSignals,
} from "../src/lib/patterns/institution-patterns.ts";
import { classifyTrend, countInTimeWindow } from "../src/lib/patterns/trend.ts";
import { applyOfficerAction } from "../src/lib/officer-model.ts";
import { studentRelatedSignal } from "../src/lib/similarity/similarity.ts";

const asOf = "2026-10-24T10:00:00+05:30";
const refundDescription =
  "I cancelled my admission and requested a refund of my admission fee. The fictional institution acknowledged my request but payment is still pending. Please confirm the refund processing date and amount.";

function record(overrides = {}) {
  return {
    id: "case-1",
    studentId: "student-1",
    institution: "Example Institute of Technology",
    category: "Fees / Refund",
    title: "Admission refund is still pending",
    description: refundDescription,
    submittedAt: "2026-10-22T10:00:00+05:30",
    status: "Officer Review",
    priority: "High",
    ...overrides,
  };
}

test("groups institution history by normalized institution name", () => {
  const history = getInstitutionComplaintHistory(
    [record(), record({ id: "other-institution", institution: "Other College" })],
    " example institute of technology ",
    asOf,
  );
  assert.equal(history.total, 1);
  assert.equal(history.institution, " example institute of technology ");
});

test("counts institution categories independently", () => {
  const history = getInstitutionComplaintHistory(
    [
      record(),
      record({ id: "refund-2", studentId: "student-2" }),
      record({
        id: "transcript",
        category: "Student Records",
        title: "Transcript download is unavailable",
        description:
          "The transcript download is unavailable in the student portal. Please restore access to the academic record.",
      }),
    ],
    record().institution,
    asOf,
  );
  assert.equal(history.total, 3);
  assert.equal(history.topCategory, "Fees / Refund");
});

test("related complaints form one deterministic issue cluster", () => {
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
  const history = getInstitutionComplaintHistory(
    cases,
    record().institution,
    asOf,
  );
  assert.equal(history.clusters.length, 1);
  assert.equal(history.clusters[0].complaintCount, 3);
  assert.equal(history.clusters[0].label, "Admission refund delays");
  assert.deepEqual(
    history.clusters[0].complaintIds,
    ["case-1", "case-2", "case-3"],
  );
});

test("unrelated complaints do not enter a same-category issue cluster", () => {
  const history = getInstitutionComplaintHistory(
    [
      record(),
      record({
        id: "access",
        studentId: "student-2",
        title: "Accessible chemistry laboratory",
        category: "Fees / Refund",
        description:
          "The chemistry laboratory needs a wheelchair ramp and accessible entrance.",
      }),
    ],
    record().institution,
    asOf,
  );
  assert.equal(history.clusters.length, 0);
});

test("a transcript case at the same institution remains outside the refund cluster", () => {
  const history = getInstitutionComplaintHistory(
    [
      record(),
      record({
        id: "transcript",
        studentId: "student-transcript",
        category: "Student Records",
        title: "Transcript download unavailable",
        description:
          "The transcript download is unavailable in the fictional student portal. Please restore access to the academic record.",
      }),
    ],
    record().institution,
    asOf,
  );
  assert.equal(history.clusters.length, 0);
});

test("associates the current complaint with its own issue cluster", () => {
  const cases = [record(), record({ id: "case-2", studentId: "student-2" })];
  assert.equal(
    getCurrentCaseCluster(cases, "case-1", asOf)?.complaintCount,
    2,
  );
  assert.equal(getCurrentCaseCluster(cases, "missing", asOf), undefined);
});

test("uses centralized 7, 30 and 90 day history windows", () => {
  const cases = [
    record({ submittedAt: "2026-10-24T10:00:00+05:30" }),
    record({ id: "30-day", submittedAt: "2026-09-25T10:00:00+05:30" }),
    record({ id: "90-day", submittedAt: "2026-07-26T10:00:00+05:30" }),
    record({ id: "too-old", submittedAt: "2026-07-25T10:00:00+05:30" }),
  ];
  const history = getInstitutionComplaintHistory(
    cases,
    record().institution,
    asOf,
  );
  assert.equal(history.total, 3);
  assert.equal(history.recentCount, 2);
  assert.equal(
    countInTimeWindow(cases.map((item) => item.submittedAt), asOf, 7),
    1,
  );
});

test("labels increasing, stable, decreasing and new trends deterministically", () => {
  assert.equal(classifyTrend(4, 1), "Increasing");
  assert.equal(classifyTrend(3, 3), "Stable");
  assert.equal(classifyTrend(1, 4), "Decreasing");
  assert.equal(classifyTrend(2, 0), "New pattern");
});

test("classifies the seeded refund trend as increasing", () => {
  const cases = [
    record({ submittedAt: "2026-10-14T09:00:00+05:30" }),
    record({ id: "refund-2", studentId: "student-2" }),
    record({
      id: "refund-3",
      studentId: "student-3",
      submittedAt: "2026-10-20T09:00:00+05:30",
    }),
    record({
      id: "refund-4",
      studentId: "student-4",
      submittedAt: "2026-10-23T09:00:00+05:30",
    }),
  ];
  const history = getInstitutionComplaintHistory(
    cases,
    "Example Institute of Technology",
    asOf,
  );
  const refund = history.clusters.find(
    (cluster) => cluster.label === "Admission refund delays",
  );
  assert.ok(refund);
  assert.equal(refund.trend, "Increasing");
});

test("classifies the seeded accessibility pattern as stable", () => {
  const cases = [
    record({
      id: "lab-previous",
      institution: "Example School of Technology",
      category: "Campus Facilities",
      title: "Accessible laboratory entrance",
      description:
        "This fictional request asks for accessible laboratory facilities and a clear plan for improving access.",
      submittedAt: "2026-10-14T11:00:00+05:30",
    }),
    record({
      id: "lab-recent",
      studentId: "student-2",
      institution: "Example School of Technology",
      category: "Campus Facilities",
      title: "Accessible laboratory ramp plan",
      description:
        "This fictional request asks for accessible laboratory facilities and a clear plan for improving access.",
      submittedAt: "2026-10-20T11:00:00+05:30",
    }),
  ];
  const history = getInstitutionComplaintHistory(
    cases,
    "Example School of Technology",
    asOf,
  );
  const accessibility = history.clusters.find(
    (cluster) => cluster.label === "Laboratory accessibility concerns",
  );
  assert.ok(accessibility);
  assert.equal(accessibility.trend, "Stable");
});

test("an issue group with no prior-week activity is newly observed", () => {
  const cases = [
    record({ submittedAt: "2026-10-22T10:00:00+05:30" }),
    record({
      id: "case-2",
      studentId: "student-2",
      submittedAt: "2026-10-23T10:00:00+05:30",
    }),
  ];
  assert.equal(
    getInstitutionComplaintHistory(cases, record().institution, asOf)
      .clusters[0].trend,
    "New pattern",
  );
});

test("reports actual workflow status counts", () => {
  const history = getInstitutionComplaintHistory(
    [
      record({ status: "Officer Review" }),
      record({ id: "resolved", status: "Resolved" }),
      record({ id: "escalated", status: "Escalated" }),
    ],
    record().institution,
    asOf,
  );
  assert.deepEqual(history.statusBreakdown, {
    "Officer Review": 1,
    Resolved: 1,
    Escalated: 1,
  });
});

test("reports priority counts without interpreting institution risk", () => {
  const history = getInstitutionComplaintHistory(
    [
      record({ priority: "High" }),
      record({ id: "critical", priority: "Critical" }),
      record({ id: "low", priority: "Low" }),
    ],
    record().institution,
    asOf,
  );
  assert.deepEqual(history.priorityBreakdown, {
    Critical: 1,
    High: 1,
    Medium: 0,
    Low: 1,
  });
});

test("institution totals distinguish open, resolved and escalated cases", () => {
  const history = getInstitutionComplaintHistory(
    [
      record({ status: "Officer Review" }),
      record({ id: "resolved", status: "Resolved" }),
      record({ id: "closed", status: "Closed" }),
      record({ id: "escalated", status: "Escalated" }),
    ],
    record().institution,
    asOf,
  );
  assert.equal(history.total, 4);
  assert.equal(history.open, 2);
  assert.equal(history.resolved, 2);
  assert.equal(history.escalated, 1);
});

test("cell transfer does not alter institution cluster results", () => {
  const base = {
    ...record(),
    updatedAt: asOf,
    dueAt: "2026-10-30T10:00:00+05:30",
    events: [],
    student: { name: "Demo Student", incidentDate: "", contacted: "No" },
    summary: {
      text: "Fictional summary",
      source: "Demo",
      suggestion: "Review",
      reason: "Sample",
    },
    evidence: [],
    similar: [],
  };
  const moved = applyOfficerAction(
    base,
    {
      type: "transfer",
      cellId: "finance",
      reason: "Fictional finance review is appropriate.",
    },
    asOf,
    "transfer",
  );
  const before = getInstitutionComplaintHistory(
    [base, record({ id: "case-2", studentId: "student-2" })],
    base.institution,
    asOf,
  );
  const after = getInstitutionComplaintHistory(
    [moved, record({ id: "case-2", studentId: "student-2" })],
    base.institution,
    asOf,
  );
  assert.deepEqual(after.clusters, before.clusters);
});

test("routing overrides do not change complaint grouping", () => {
  const cases = [
    record(),
    record({ id: "case-2", studentId: "student-2" }),
  ];
  const overridden = [
    { ...cases[0], cellId: "finance", overriddenByOfficer: true },
    cases[1],
  ];
  assert.deepEqual(
    getInstitutionComplaintHistory(overridden, record().institution, asOf)
      .clusters,
    getInstitutionComplaintHistory(cases, record().institution, asOf)
      .clusters,
  );
});

test("student related projection exposes only a boolean, not institution history", () => {
  const privateCases = [
    record(),
    record({
      id: "private-case",
      studentId: "other-student",
      title: "Admission refund delay",
      privateName: "PRIVATE NAME",
      evidence: [{ name: "private.pdf" }],
    }),
  ];
  const projection = studentRelatedSignal(
    privateCases[0],
    privateCases,
    "student-1",
  );
  assert.equal(projection, true);
  assert.equal(typeof projection, "boolean");
  assert.equal(
    JSON.stringify(projection).includes("PRIVATE"),
    false,
  );
  assert.equal(
    studentRelatedSignal(privateCases[0], privateCases, "intruder"),
    false,
  );
});

test("deduplicates repeated complaint IDs before counting", () => {
  const history = getInstitutionComplaintHistory(
    [
      record(),
      record({
        id: "case-1",
        status: "Resolved",
        priority: "Low",
      }),
    ],
    record().institution,
    asOf,
  );
  assert.equal(history.total, 1);
  assert.equal(history.statusBreakdown.Resolved, 1);
});

test("invalid dates are excluded safely from history windows and trends", () => {
  const history = getInstitutionComplaintHistory(
    [
      record({ submittedAt: "invalid-date" }),
      record({
        id: "valid",
        studentId: "student-2",
        submittedAt: "2026-10-22T10:00:00+05:30",
      }),
    ],
    record().institution,
    asOf,
  );
  assert.equal(history.total, 1);
  assert.equal(history.recentCount, 1);
  assert.equal(history.clusters.length, 0);
  assert.equal(countInTimeWindow(["invalid-date"], asOf, 7), 0);
});

test("empty institution history returns safe zero counts", () => {
  const history = getInstitutionComplaintHistory([], "No Such Institution", asOf);
  assert.equal(history.total, 0);
  assert.equal(history.recentCount, 0);
  assert.equal(history.topCategory, "None");
  assert.deepEqual(history.clusters, []);
  assert.deepEqual(getInstitutionSignals([], asOf), []);
});

test("subcategory partitions clusters when intelligence provides it", () => {
  const history = getInstitutionComplaintHistory(
    [
      record({
        intelligence: {
          category: "Fees / Refund",
          subcategory: "Admission refund",
        },
      }),
      record({
        id: "case-2",
        studentId: "student-2",
        intelligence: {
          category: "Fees / Refund",
          subcategory: "Security deposit",
        },
      }),
    ],
    record().institution,
    asOf,
  );
  assert.equal(history.clusters.length, 0);
});

test("labels and common issue signals use readable issue language", () => {
  const history = getInstitutionComplaintHistory(
    [
      record(),
      record({
        id: "case-2",
        studentId: "student-2",
        title: "Fee refund delayed after cancellation",
      }),
    ],
    record().institution,
    asOf,
  );
  assert.equal(history.clusters[0].label, "Admission refund delays");
  assert.ok(history.clusters[0].commonIssueSignals.includes("refund"));
  assert.ok(
    history.clusters[0].commonIssueSignals.includes("admission cancellation"),
  );
  assert.ok(
    !history.clusters[0].commonIssueSignals.some((signal) =>
      /token|similarity|root cause/i.test(signal),
    ),
  );
});

test("dashboard signals include only meaningful recent clusters and are capped", () => {
  const cases = [
    record({ submittedAt: "2026-10-14T09:00:00+05:30" }),
    record({ id: "case-2", studentId: "student-2" }),
  ];
  const signals = getInstitutionSignals(cases, asOf);
  assert.ok(signals.length > 0);
  assert.ok(signals.length <= 3);
  assert.ok(signals.every((signal) => signal.cluster.recentCount > 0));
});
