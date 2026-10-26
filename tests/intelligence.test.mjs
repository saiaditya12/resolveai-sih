import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyComplaintFallback,
  determinePriority,
  evaluateConfidence,
} from "../src/lib/intelligence/fallback.ts";
import { resolveRouting } from "../src/lib/intelligence/routing-config.ts";
import { validateComplaintIntelligenceResult } from "../src/lib/intelligence/schema.ts";

const analyzedAt = "2026-10-24T10:00:00.000Z";
const classify = (title, description) =>
  classifyComplaintFallback({ title, description, analyzedAt });

test("refund complaint uses the finance/refund prototype cell", () => {
  const result = classify(
    "Admission fee refund",
    "College has not refunded my admission fee after cancellation for 45 days.",
  );
  assert.equal(result.category, "Fees / Refund");
  assert.equal(result.recommendedCellId, "finance");
  assert.equal(result.recommendedCellName, "Demo Finance/Refund Review Cell");
  assert.equal(result.priority, "High");
});

test("transcript complaint uses the academic records prototype cell", () => {
  const result = classify(
    "Transcript not issued",
    "My transcript has not been issued despite repeated requests.",
  );
  assert.equal(result.category, "Student Records");
  assert.equal(result.recommendedCellId, "records");
  assert.equal(result.recommendedCellName, "Demo Academic Records Cell");
});

test("scholarship complaint is classified into financial support", () => {
  const result = classify(
    "Scholarship payment",
    "My scholarship amount has not been credited.",
  );
  assert.equal(result.category, "Scholarship / Financial Support");
  assert.equal(result.recommendedCellId, "student");
});

test("exposed wiring is an infrastructure complaint with elevated priority", () => {
  const result = classify(
    "Electrical hazard in classroom",
    "The classroom has exposed electrical wiring and sparks near student seating.",
  );
  assert.equal(result.category, "Infrastructure / Facilities");
  assert.equal(result.recommendedCellId, "student");
  assert.equal(result.priority, "High");
  assert.match(result.urgencyReason, /safety concern/i);
});

test("recognition complaint uses the approval prototype cell", () => {
  const result = classify(
    "Verify institutional recognition",
    "The institution says it is approved but I cannot verify recognition.",
  );
  assert.equal(result.category, "Approval / Recognition");
  assert.equal(result.recommendedCellId, "approval");
  assert.equal(result.recommendedCellName, "Demo Approval Review Cell");
});

test("unmatched complaint is low-confidence Other and requires manual review", () => {
  const result = classify(
    "Please help",
    "Nothing is working and nobody responds.",
  );
  assert.equal(result.category, "Other");
  assert.ok(result.confidence < 0.6);
  assert.equal(result.recommendedCellId, null);
  assert.equal(result.needsManualReview, true);
  assert.equal(result.source, "Manual Review");
});

test("conflicting category signals are not auto-routed", () => {
  const result = classify(
    "Refund and transcript issue",
    "My refund is missing and my transcript has not been issued.",
  );
  assert.equal(result.confidence, 0.59);
  assert.equal(result.needsManualReview, true);
  assert.equal(result.recommendedCellId, null);
});

test("invalid cell IDs never resolve to an arbitrary route", () => {
  const result = resolveRouting("Fees / Refund", "unlisted-cell");
  assert.equal(result.recommendedCellId, null);
  assert.equal(result.needsManualReview, true);
  assert.match(result.manualReviewReason, /unknown or unavailable/);

  const mismatched = resolveRouting("Fees / Refund", "approval");
  assert.equal(mismatched.recommendedCellId, null);
  assert.match(mismatched.manualReviewReason, /does not match/);
});

test("confidence policy honors the exact threshold boundaries", () => {
  const category = "Fees / Refund";
  for (const [confidence, needsManualReview, reviewRecommended] of [
    [0.59, true, false],
    [0.6, false, true],
    [0.79, false, true],
    [0.8, false, false],
  ]) {
    const result = evaluateConfidence(confidence, category, "finance");
    assert.equal(result.needsManualReview, needsManualReview);
    assert.equal(result.reviewRecommended, reviewRecommended);
  }
  assert.throws(
    () => evaluateConfidence(1.01, category, "finance"),
    /0 through 1/,
  );
  assert.equal(
    evaluateConfidence(0.99, category, "unknown-cell").needsManualReview,
    true,
  );
});

test("Other always requires manual review, even at high confidence", () => {
  const result = evaluateConfidence(0.99, "Other", null);
  assert.equal(result.needsManualReview, true);
  assert.match(result.manualReviewReason, /always require manual review/);
});

test("result validation rejects invalid categories, priorities, confidence, cells and sources", () => {
  const valid = classify(
    "Admission fee refund",
    "College has not refunded my admission fee after cancellation for 45 days.",
  );
  for (const invalid of [
    { ...valid, category: "Unknown" },
    { ...valid, priority: "Urgent" },
    { ...valid, confidence: 1.1 },
    { ...valid, recommendedCellId: "unlisted-cell" },
    { ...valid, source: "Unverified" },
  ]) {
    assert.throws(() => validateComplaintIntelligenceResult(invalid));
  }
});

test("classification and summary are deterministic for a fixed analysis time", () => {
  const complaint = {
    title: "Refund not received",
    description: "The cancelled fee has not been refunded after 45 days.",
    analyzedAt,
  };
  assert.deepEqual(
    classifyComplaintFallback(complaint),
    classifyComplaintFallback(complaint),
  );
});

test("priority rules elevate explicit safety terms without unsupported conclusions", () => {
  const result = determinePriority(
    "Safety issue",
    "There is an immediate safety risk from a fire near the classroom.",
  );
  assert.equal(result.priority, "Critical");
  assert.match(result.urgencyReason, /without making a legal or medical determination/);
});
