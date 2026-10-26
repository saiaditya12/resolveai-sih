import test from "node:test";
import assert from "node:assert/strict";
import {
  demoTracking,
  demoSla,
  stageState,
  stages,
  lifecycleStatuses,
  getTracking,
  responseError,
} from "../src/lib/complaint-tracking.ts";
import { complaints } from "../src/lib/demo-student.ts";
test("every seeded case has consistent chronological demo history", () => {
  for (const c of complaints) {
    const d = getTracking(c);
    assert.ok(d);
    assert.equal(d.events[0].at, d.submittedAt);
    assert.equal(d.events.at(-1).at, c.updatedAt);
    assert.ok(
      d.events.every(
        (e, i) => i === 0 || Date.parse(e.at) >= Date.parse(d.events[i - 1].at),
      ),
    );
  }
});
test("all ten lifecycle statuses have an understandable stage model", () => {
  assert.equal(lifecycleStatuses.length, 10);
  for (const status of lifecycleStatuses) {
    const states = stages.map((_, i) => stageState(status, i));
    assert.equal(
      states.filter((s) => s === "current").length,
      ["Resolved", "Closed"].includes(status) ? 0 : 1,
    );
  }
  assert.equal(stageState("Submitted", 1), "pending");
  assert.equal(stageState("Student Action Required", 5), "pending");
  assert.equal(stageState("Resolved", 6), "completed");
});
test("fixed demo SLA covers normal, due soon, overdue and escalated without live claims", () => {
  assert.equal(demoSla("2026-10-27T10:00:00+05:30").state, "Normal");
  assert.equal(demoSla("2026-10-25T10:00:00+05:30").state, "Due Soon");
  assert.equal(demoSla("2026-10-20T10:00:00+05:30").state, "Overdue");
  assert.equal(demoSla("2026-10-20T10:00:00+05:30", true).state, "Escalated");
  assert.equal(demoSla(null).state, "Not scheduled");
  assert.equal(demoSla(null, false, true).state, "Complete");
});
test("new local cases never inherit fake routing or SLA events", () => {
  const c = {
    id: "GRV-2026-9999",
    title: "Local test",
    institution: "Demo",
    category: "Other",
    status: "Submitted",
    updatedAt: "2026-10-24T10:00:00Z",
  };
  const local = {
    ...c,
    submittedAt: c.updatedAt,
    description: "Fictional details",
    incidentDate: "",
    contacted: "no",
    contactDate: "",
    response: "",
    evidence: [],
  };
  const d = getTracking(c, local);
  assert.equal(d.events.length, 1);
  assert.equal(d.owner, null);
  assert.equal(d.status, "Submitted");
  assert.equal(d.sla.state, "Not scheduled");
});
test("local response updates a copy without mutating the demo source", () => {
  const c = complaints.find((c) => c.id === "GRV-2026-1018");
  const response = {
    id: "response",
    at: "2026-10-24T10:00:00Z",
    text: "Fictional response text",
    evidence: [],
  };
  const d = getTracking(c, undefined, { response });
  assert.equal(d.request, undefined);
  assert.equal(d.status, "Officer Review");
  assert.equal(d.events.at(-1).id, "response");
  assert.ok(demoTracking[c.id].request);
  assert.equal(demoTracking[c.id].status, "Student Action Required");
});
test("response validation supports text or local evidence and rejects empty or excessive text", () => {
  assert.ok(responseError("   ", 0));
  assert.ok(responseError("short", 0));
  assert.equal(responseError("A useful demo response", 0), null);
  assert.equal(responseError("", 1), null);
  assert.ok(responseError("x".repeat(1501), 1));
});
