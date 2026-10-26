import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyDraft,
  restoreComplaintDraft,
  serializeComplaintDraft,
  todayInIndia,
  validateDetails,
  validPastDate,
  evidenceError,
  MAX_FILE_BYTES,
  institutions,
} from "../src/lib/complaint-flow.ts";

const valid = {
  ...emptyDraft,
  title: "Sample issue",
  description: "A".repeat(50),
  contacted: "no",
};
const today = "2026-10-24";
test("fictional institution directory has ten unique IDs", () => {
  assert.equal(institutions.length, 10);
  assert.equal(new Set(institutions.map((i) => i.id)).size, 10);
});
test("required fields and whitespace boundaries", () => {
  assert.deepEqual(Object.keys(validateDetails(emptyDraft, today)), [
    "title",
    "description",
    "contacted",
  ]);
  assert.deepEqual(validateDetails(valid, today), {});
  for (const description of [" ".repeat(60), "A".repeat(49), "A".repeat(3001)])
    assert.ok(validateDetails({ ...valid, description }, today).description);
  assert.ok(validateDetails({ ...valid, title: "A".repeat(121) }, today).title);
});
test("India date helper formats an explicitly supplied timestamp", () => {
  assert.equal(todayInIndia(new Date("2026-10-23T19:00:00.000Z")), today);
});
test("complaint drafts restore text and institution without file objects", () => {
  const draft = {
    ...valid,
    institution: institutions[0],
    evidence: [{ id: "file", name: "sample.pdf", type: "application/pdf", size: 1 }],
  };
  const restored = restoreComplaintDraft(serializeComplaintDraft(draft));
  assert.deepEqual(restored, { ...draft, evidence: [] });
  assert.throws(() => restoreComplaintDraft('{"institution":{"id":"unknown"}}'));
});
test("dates reject future, malformed and impossible dates", () => {
  for (const date of ["2099-01-01", "2026-02-30", "1899-01-01", "invalid"])
    assert.equal(validPastDate(date, "2026-10-24"), false);
  assert.equal(validPastDate("2024-02-29", "2026-10-24"), true);
  assert.ok(
    validateDetails({ ...valid, incidentDate: "2099-01-01" }, today)
      .incidentDate,
  );
  assert.ok(
    validateDetails(
      { ...valid, contacted: "yes", contactDate: "2099-01-01" },
      today,
    )
      .contactDate,
  );
  assert.deepEqual(
    validateDetails({ ...valid, contactDate: "2099-01-01" }, today),
    {},
  );
});
test("evidence validates extension, MIME, empty files and size boundaries", () => {
  for (const [name, type] of [
    ["sample.pdf", "application/pdf"],
    ["sample.png", "image/png"],
    ["sample.jpeg", "image/jpeg"],
    ["sample.jpg", "image/jpeg"],
  ])
    assert.equal(evidenceError({ name, type, size: MAX_FILE_BYTES }), null);
  for (const file of [
    { name: "sample.txt", type: "text/plain", size: 10 },
    { name: "sample.pdf", type: "text/plain", size: 10 },
    { name: "sample.png", type: "image/png", size: 0 },
    { name: "sample.pdf", type: "application/pdf", size: MAX_FILE_BYTES + 1 },
  ])
    assert.ok(evidenceError(file));
});
