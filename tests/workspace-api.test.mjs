import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as authorization from "../src/lib/authorization.ts";
import * as model from "../src/lib/officer-model.ts";

const code = ts.transpileModule(readFileSync(new URL("../src/app/api/complaints/[id]/actions/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function harness(role, cell_id) {
  const profile = { id: "trusted-user", display_name: "Trusted Officer", role, cell_id };
  let record = { id: "GRV-2026-9422", studentId: "student", cellId: "finance", recommendedCellId: "finance", status: "Officer Review", routingStatus: "routed", events: [], updatedAt: "2026-10-25T10:00:00Z" };
  const calls = [];
  const modules = {
    "@/lib/authorization": authorization,
    "@/lib/officer-model": model,
    "@/lib/persistence/api": {
      requireApiRole: async (roles) => roles.includes(role) ? { profile } : { error: Response.json({ error: "Forbidden" }, { status: 403 }) },
      readJsonBody: async request => request.json(),
      databaseEventId: () => "00000000-0000-0000-0000-000000000001",
      jsonError: () => Response.json({ error: "Invalid body" }, { status: 400 }),
      loadPersistentComplaint: async (_id, trusted) => authorization.canReadComplaint(trusted, record) ? record : null,
    },
    "@/lib/supabase/server": { createSupabaseAdminClient: () => ({
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { updated_at: record.updatedAt } }) }) }) }),
      rpc: async (name, args) => { calls.push({ name, args }); record = { ...record, cellId: args.p_patch.cell_id, status: args.p_patch.status }; return {}; },
    }) },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in modules); return modules[name]; }, Response, Date, Intl });
  return {
    calls,
    post: body => exports.POST(new Request("http://localhost/api/complaints/GRV-2026-9422/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: record.id }) }),
  };
}
const actions = [
  { type: "request", recipient: "Student", text: "Please provide the payment receipt.", dueDate: "" },
  { type: "request", recipient: "Institution", text: "Please provide the payment receipt.", dueDate: "" },
  { type: "status", status: "Institution Response Requested", note: "Waiting for an institutional response." },
  { type: "transfer", cellId: "records", reason: "The complaint concerns records processing." },
  { type: "escalate", reason: "Higher level review is required." },
  { type: "resolve", summary: "The record issue is resolved.", action: "The corrected record was supplied.", reference: "" },
];
for (const action of actions) {
  for (const [role, cell, allowed] of [["student",null,false],["officer","records",false],["officer",null,false],["officer","finance",true],["admin",null,true]]) {
    test(`action API ${action.type}/${action.recipient ?? "case"}: ${role}/${cell}`, async () => {
      const h = harness(role, cell);
      const response = await h.post({ action, cell_id: "finance", role: "admin", actor_id: "forged" });
      if (!allowed) { assert.ok([403,404].includes(response.status)); assert.equal(h.calls.length,0); return; }
      assert.equal(response.status,200);
      assert.equal(h.calls.length,1);
      const args = h.calls[0].args;
      assert.equal(args.p_actor_id,"trusted-user");
      assert.equal(args.p_event.details.actor_role,role);
      assert.equal(args.p_event.details.actor_cell,cell);
      assert.equal("recommended_cell_id" in args.p_patch,false);
      const body = await response.json();
      if (action.type === "transfer" && role === "officer") {
        assert.equal(body.record,null);
        assert.equal(body.removedId,"GRV-2026-9422");
      } else assert.ok(body.record);
    });
  }
}
for (const action of [{ type:"status",status:"arbitrary",note:"Long enough explanation" }, { type:"transfer",cellId:"finance",reason:"Long enough explanation" }, { type:"transfer",cellId:"unknown",reason:"Long enough explanation" }, { type:"escalate",reason:"" }]) {
  test(`action API rejects invalid ${JSON.stringify(action)}`, async () => {
    const h = harness("officer","finance");
    assert.equal((await h.post({ action })).status,400);
    assert.equal(h.calls.length,0);
  });
}
