import test from "node:test";
import assert from "node:assert/strict";
import { reviewCells } from "../src/lib/cells.ts";
import {
  auditDisplayText,
  cellDisplayName,
  institutionDisplayName,
  institutionResponseDisplayText,
  normalizeInstitutionName,
  personDisplayName,
  roleDisplayName,
  systemDisplayText,
} from "../src/lib/presentation.ts";

test("display labels keep the canonical cell configuration intact", () => {
  const before = JSON.stringify(reviewCells);
  for (const cell of reviewCells) {
    assert.equal(cellDisplayName(cell.id), cellDisplayName(cell.name));
    assert.doesNotMatch(cellDisplayName(cell.name), /demo|prototype/i);
  }
  assert.equal(JSON.stringify(reviewCells), before);
  assert.equal(cellDisplayName("records"), "Student Records Cell");
});

test("role labels use product names and neutral unknown-role fallback", () => {
  assert.equal(roleDisplayName("student"), "Student");
  assert.equal(roleDisplayName("officer"), "Cell Officer");
  assert.equal(roleDisplayName("admin"), "Administrator");
  assert.equal(roleDisplayName("unknown"), "Account");
});

test("fixture identities display neutral role labels without changing stored names", () => {
  assert.equal(personDisplayName("Demo Officer A. Mehra"), "Cell Officer");
  assert.equal(personDisplayName("Demo Student A. Sharma"), "Student");
  assert.equal(personDisplayName("Fictional Student 2"), "Student");
  assert.equal(personDisplayName("Demo Student"), "Student");
  assert.equal(personDisplayName("Aarav Sharma"), "Aarav Sharma");
  assert.equal(personDisplayName("Sai"), "Sai");
  assert.equal(personDisplayName(undefined), "Not provided");
});

test("directory labels do not mutate submitted institution data", () => {
  const record = { institution: "Example Institute of Technology" };
  assert.equal(institutionDisplayName(record.institution), "Example Institute of Technology");
  assert.equal(record.institution, "Example Institute of Technology");
  assert.equal(institutionDisplayName("Demo Riverbend Polytechnic"), "Riverbend Polytechnic");
  assert.equal(
    normalizeInstitutionName("Demo Example Institute of Technology"),
    normalizeInstitutionName(record.institution),
  );
});

test("legacy system history and unverified fixture responses receive neutral copy", () => {
  assert.equal(auditDisplayText("Assigned to demo cell"), "Assigned to review cell");
  assert.equal(
    auditDisplayText("Prewritten sample history; no real assignment occurred."),
    "Review history recorded.",
  );
  const response = "Fictional acknowledgement: refund is being checked. No transaction confirmation is included in this sample.";
  assert.equal(
    institutionResponseDisplayText(response),
    "No verified institution response is available for this record.",
  );
  assert.equal(response, "Fictional acknowledgement: refund is being checked. No transaction confirmation is included in this sample.");
});

test("system labels preserve timing values and recommendation meaning", () => {
  assert.equal(systemDisplayText("Prototype / demo policy"), "Service-level target");
  assert.equal(systemDisplayText("Prototype target: 48 hours"), "target: 48 hours");
  assert.equal(systemDisplayText("Choose a different demo cell."), "Choose a different cell.");
  assert.equal(systemDisplayText("Manual review required"), "Manual review required");
});
