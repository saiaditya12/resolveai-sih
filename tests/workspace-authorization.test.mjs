import test from "node:test";
import assert from "node:assert/strict";
import { canReadComplaint, canActOnComplaint, canEnterWorkspace, workspaceHome, actionAudit } from "../src/lib/authorization.ts";
import { reviewCells } from "../src/lib/cells.ts";
import { applyOfficerAction, validateOfficerAction } from "../src/lib/officer-model.ts";

const profile = (role, cell_id = null, id = role) => ({ id, role, cell_id, display_name: "Fixture account" });
const student = profile("student"), finance = profile("officer", "finance"), records = profile("officer", "records"), admin = profile("admin");
const item = { id: "GRV-2026-9422", studentId: "student", cellId: "finance", recommendedCellId: "finance", routingStatus: "routed", status: "Officer Review", events: [], updatedAt: "2026-10-25T10:00:00Z" };
for (const [name, user, allowed] of [["own student", student, true], ["other student", profile("student", null, "other"), false], ["finance officer", finance, true], ["records officer", records, false], ["admin", admin, true], ["unassigned officer", profile("officer"), false], ["unknown cell", profile("officer", "forged"), false]]) {
  test(`${name}: complaint read authorization`, () => assert.equal(canReadComplaint(user, item), allowed));
}
for (const role of ["student", "officer", "admin"]) for (const workspace of ["student", "officer", "admin"]) {
  test(`${role} workspace boundary: ${workspace}`, () => assert.equal(canEnterWorkspace(profile(role), workspace), role === workspace));
}
for (const type of ["request", "status", "transfer", "escalate", "resolve"]) {
  test(`${type}: only current officer/admin may act`, () => {
    assert.equal(canActOnComplaint(finance, item), true);
    assert.equal(canActOnComplaint(records, item), false);
    assert.equal(canActOnComplaint(student, item), false);
    assert.equal(canActOnComplaint(admin, item), true);
    assert.equal(canActOnComplaint(profile("officer"), item), false);
  });
}
test("transfer changes ownership, preserves recommendation and attributes audit", () => {
  const action = { type: "transfer", cellId: "records", reason: "This concerns transcript processing." };
  const next = applyOfficerAction(item, action, "2026-10-25T11:00:00Z", "transfer");
  assert.equal(next.cellId, "records");
  assert.equal(next.recommendedCellId, "finance");
  assert.equal(canActOnComplaint(finance, next), false);
  assert.equal(canReadComplaint(finance, next), false);
  assert.equal(canActOnComplaint(records, next), true);
  assert.equal(canReadComplaint(admin, next), true);
  assert.deepEqual(actionAudit(finance, item.cellId, next.cellId, action.type, action.reason), {
    action: "transfer", actor_id: finance.id, actor_name: finance.display_name, actor_role: "officer", actor_cell: "finance", from_cell: "finance", to_cell: "records", reason: action.reason,
  });
});
test("escalation retains cell and is visible to admin", () => {
  const next = applyOfficerAction(item, { type: "escalate", reason: "Higher-level review is required." }, "2026-10-25T11:00:00Z", "escalation");
  assert.equal(next.cellId, "finance");
  assert.equal(next.status, "Escalated");
  assert.equal(canReadComplaint(admin, next), true);
});
test("invalid and same-cell transfers fail", () => {
  for (const cellId of ["finance", "unknown"]) assert.ok(validateOfficerAction(item, { type: "transfer", cellId, reason: "Valid length transfer reason" }, "2026-10-25"));
});
test("a newly configured cell uses the same authorization and workspace", () => {
  reviewCells.push({ id: "fixture-new-cell", name: "Demo Fixture Cell", description: "Test only" });
  try {
    const officer = profile("officer", "fixture-new-cell");
    assert.equal(workspaceHome(officer.role), "/officer/dashboard");
    assert.equal(canActOnComplaint(officer, { ...item, cellId: officer.cell_id }), true);
  } finally { reviewCells.pop(); }
});
