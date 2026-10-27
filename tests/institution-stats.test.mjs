import test from "node:test";
import assert from "node:assert/strict";
import { getInstitutionComplaintStats } from "../src/lib/patterns/institution-stats.ts";
import {
  institutionDisplayName,
  normalizeInstitutionName,
} from "../src/lib/presentation.ts";

const asOf = "2026-10-27T12:00:00.000Z";
const institution = "Example Institute of Technology";

function complaint(overrides = {}) {
  return {
    institution,
    submittedAt: "2026-10-22T12:00:00.000Z",
    category: "Fees / Refund",
    status: "Officer Review",
    priority: "High",
    ...overrides,
  };
}

test("one persisted complaint contributes one institution-wide open count", () => {
  const stats = getInstitutionComplaintStats(
    [complaint()],
    institution,
    asOf,
  );
  assert.equal(stats.total, 1);
  assert.equal(stats.recentCount, 1);
  assert.equal(stats.open, 1);
  assert.equal(stats.resolved, 0);
  assert.equal(stats.escalated, 0);
  assert.equal(stats.topCategory, "Fees / Refund");
});

test("multiple normalized matches aggregate without double-counting categories", () => {
  const stats = getInstitutionComplaintStats(
    [
      complaint(),
      complaint({
        institution: "demo example institute of technology",
        submittedAt: "2026-10-21T12:00:00.000Z",
      }),
      complaint({
        institution: "Another Institute",
        category: "Student Records",
      }),
    ],
    institution,
    asOf,
  );
  assert.equal(stats.total, 2);
  assert.equal(stats.recentCount, 2);
  assert.equal(stats.open, 2);
  assert.equal(stats.topCategory, "Fees / Refund");
});

test("a complaint from a different institution is excluded", () => {
  const stats = getInstitutionComplaintStats(
    [complaint({ institution: "Other Institute" })],
    institution,
    asOf,
  );
  assert.equal(stats.total, 0);
  assert.equal(stats.recentCount, 0);
  assert.equal(stats.topCategory, "None");
});

test("resolved complaints count as resolved and not open", () => {
  const stats = getInstitutionComplaintStats(
    [complaint({ status: "Resolved" })],
    institution,
    asOf,
  );
  assert.equal(stats.resolved, 1);
  assert.equal(stats.open, 0);
});

test("escalated complaints count as both open and escalated", () => {
  const stats = getInstitutionComplaintStats(
    [complaint({ status: "Escalated" })],
    institution,
    asOf,
  );
  assert.equal(stats.open, 1);
  assert.equal(stats.escalated, 1);
});

test("top category is the most common category in the 30-day window", () => {
  const stats = getInstitutionComplaintStats(
    [
      complaint(),
      complaint({ category: "Fees / Refund" }),
      complaint({ category: "Student Records" }),
    ],
    institution,
    asOf,
  );
  assert.equal(stats.topCategory, "Fees / Refund");
});

test("30-day and 90-day windows use the current reporting timestamp", () => {
  const stats = getInstitutionComplaintStats(
    [
      complaint({ submittedAt: "2026-10-20T12:00:00.000Z" }),
      complaint({ submittedAt: "2026-09-10T12:00:00.000Z" }),
      complaint({ submittedAt: "2026-07-01T12:00:00.000Z" }),
      complaint({ submittedAt: "2026-10-28T12:00:00.000Z" }),
    ],
    institution,
    asOf,
  );
  assert.equal(stats.total, 2);
  assert.equal(stats.recentCount, 1);
});

test("display and match normalization do not split legacy institution labels", () => {
  assert.equal(institutionDisplayName(institution), institution);
  assert.equal(
    normalizeInstitutionName("Demo Example Institute of Technology"),
    normalizeInstitutionName(institution),
  );
  const stats = getInstitutionComplaintStats(
    [
      complaint(),
      complaint({ institution: "Demo Example Institute of Technology" }),
    ],
    institution,
    asOf,
  );
  assert.equal(stats.total, 2);
});
