import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { reviewCells } from "../src/lib/cells.ts";

const ids = {
  student: "00000000-0000-0000-0000-000000000001",
  finance: "00000000-0000-0000-0000-000000000002",
  records: "00000000-0000-0000-0000-000000000003",
  admin: "00000000-0000-0000-0000-000000000004",
  unassigned: "00000000-0000-0000-0000-000000000005",
  otherStudent: "00000000-0000-0000-0000-000000000006",
};
test("Postgres migrations enforce cell ownership and preserve persistent workflow", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;
      grant usage on schema public,auth to authenticated,service_role,anon;
      grant execute on function auth.uid(),auth.role() to authenticated,service_role,anon;
    `);
    // PGlite supplies built-in gen_random_uuid; it does not bundle pgcrypto.
    const original = readFileSync(new URL("../supabase/migrations/20261024180000_phase10_persistence_auth.sql", import.meta.url), "utf8");
    await db.exec(original.replace("create extension if not exists pgcrypto;", ""));
    await db.exec(readFileSync(new URL("../supabase/migrations/20261025090000_role_cell_workspaces.sql", import.meta.url), "utf8"));
    for (const [name, id] of Object.entries(ids)) {
      await db.query("insert into auth.users values ($1,$2,$3)", [id, `${name}@example.invalid`, { display_name: name, role: "admin", cell_id: "finance" }]);
    }
    await t.test("signup ignores forged role/cell metadata", async () => {
      const { rows } = await db.query("select role,cell_id from public.profiles");
      assert.ok(rows.every(p => p.role === "student" && p.cell_id === null));
    });
    for (const [name, role, cell] of [["finance","officer","finance"],["records","officer","records"],["admin","admin",null],["unassigned","officer",null]]) {
      await db.query("update profiles set role=$1,cell_id=$2 where id=$3", [role, cell, ids[name]]);
    }
    await db.query(`insert into complaints(id,student_id,institution,title,description,cell_id,recommended_cell_id,status,routing_status,updated_at)
      values ('GRV-2026-9422',$1,'Demo Institute','Refund pending','Fictional refund complaint for authorization testing.','finance','finance','Officer Review','routed','2026-10-25T10:00:00Z'),
      ('GRV-2026-9500',$2,'Demo Institute','Transcript pending','Fictional transcript complaint for authorization testing.','records','records','Assigned','routed','2026-10-25T10:00:00Z')`, [ids.student, ids.otherStudent]);
    await db.query("insert into complaint_events(complaint_id,actor_type,event_type,title) values ('GRV-2026-9422','Student','complaint_submitted','Complaint submitted'),('GRV-2026-9500','Student','complaint_submitted','Complaint submitted')");
    await db.query("insert into complaint_evidence(complaint_id,student_id,name,mime_type,size_bytes) values ('GRV-2026-9422',$1,'receipt.pdf','application/pdf',10)", [ids.student]);
    async function asUser(name, sql, args = []) {
      await db.exec("set role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role','authenticated',false)", [ids[name]]);
      try { return await db.query(sql,args); } finally { await db.exec("reset role"); }
    }
    await t.test("database cell registry matches canonical configuration", async () => {
      const { rows } = await db.query("select id,name,description from review_cells order by id");
      assert.deepEqual(rows, [...reviewCells].sort((a,b)=>a.id.localeCompare(b.id)));
    });
    for (const [name, expected] of [["student",["GRV-2026-9422"]],["otherStudent",["GRV-2026-9500"]],["finance",["GRV-2026-9422"]],["records",["GRV-2026-9500"]],["admin",["GRV-2026-9422","GRV-2026-9500"]],["unassigned",[]]]) {
      await t.test(`RLS complaint and event isolation: ${name}`, async () => {
        assert.deepEqual((await asUser(name,"select id from complaints order by id")).rows.map(r=>r.id), expected);
        assert.deepEqual((await asUser(name,"select complaint_id from complaint_events order by complaint_id")).rows.map(r=>r.complaint_id), expected);
      });
    }
    await t.test("unrelated officer cannot read evidence", async () => {
      assert.equal((await asUser("records","select * from complaint_evidence")).rows.length,0);
      assert.equal((await asUser("finance","select * from complaint_evidence")).rows.length,1);
    });
    for (const name of ["student","finance","records","unassigned"]) {
      await t.test(`${name} cannot self-promote or self-assign`, async () => {
        await assert.rejects(asUser(name,"update profiles set role='admin',cell_id=null where id=$1",[ids[name]]), /permission denied/);
        await assert.rejects(asUser(name,"update profiles set cell_id='records' where id=$1",[ids[name]]), /permission denied/);
        await assert.rejects(asUser(name,"update complaints set cell_id='records' where id='GRV-2026-9422'"), /permission denied/);
      });
    }
    let tick = 11;
    async function act(name, action, overrides = {}, details = {}) {
      const before = (await db.query("select * from complaints where id='GRV-2026-9422'")).rows[0];
      const at = `2026-10-25T${String(tick++).padStart(2,"0")}:00:00Z`;
      const patch = { status: before.status, cell_id: before.cell_id, routing_status: before.routing_status, request: before.request, resolution: before.resolution, updated_at: at, ...overrides };
      const event = { id: crypto.randomUUID(), at, event_type: action === "request" ? "information_requested_student" : `case_${action}`, title: `Case ${action}`, explanation: "A sufficiently detailed fixture action explanation.", details: { action, actor_role: "admin", actor_cell: "forged", ...details } };
      await db.exec("set role service_role");
      await db.query("select set_config('request.jwt.claim.role','service_role',false)");
      try { await db.query("select persist_officer_action($1,'GRV-2026-9422',$2,$3,$4)",[ids[name],before.updated_at,patch,event]); }
      finally { await db.exec("reset role"); }
    }
    for (const action of ["request","status","transfer","escalate","resolve"]) {
      await t.test(`RPC rejects wrong-cell ${action} despite forged actor details`, async () => {
        await assert.rejects(act("records",action),/forbidden/); tick--;
      });
    }
    await t.test("unassigned officer denied by RPC", async () => { await assert.rejects(act("unassigned","status"),/forbidden/); tick--; });
    await t.test("finance officer request persists trusted actor and student can respond", async () => {
      await act("finance","request",{status:"Student Action Required",request:{prompt:"Please provide the fee receipt.",dueAt:""}});
      const { rows } = await db.query("select details from complaint_events where event_type='information_requested_student'");
      assert.equal(rows[0].details.actor_role,"officer");
      assert.equal(rows[0].details.actor_cell,"finance");
      assert.equal(rows[0].details.actor_name,"finance");
      await db.exec("set role service_role");
      await db.query("select persist_student_response($1,'GRV-2026-9422',$2)",[ids.student,{at:"2026-10-25T11:30:00Z",text:"Here is the requested fee receipt information.",evidence:[]}]);
      await db.exec("reset role");
      assert.equal((await db.query("select status from complaints where id='GRV-2026-9422'")).rows[0].status,"Officer Review");
    });
    await t.test("owner status update persists", async () => { await act("finance","status",{status:"Institution Response Requested"}); });
    await t.test("invalid status and transfers rejected atomically", async () => {
      await assert.rejects(act("finance","status",{status:"arbitrary"}),/invalid/); tick--;
      for (const cell_id of ["finance","unknown"]) { await assert.rejects(act("finance","transfer",{cell_id},{reason:"Transfer for records review"}),/invalid/); tick--; }
    });
    await t.test("transfer atomically moves access and preserves recommendation", async () => {
      await act("finance","transfer",{cell_id:"records",overridden_by_officer:true},{reason:"Complaint concerns transcript processing."});
      const row = (await db.query("select cell_id,recommended_cell_id from complaints where id='GRV-2026-9422'")).rows[0];
      assert.deepEqual(row,{cell_id:"records",recommended_cell_id:"finance"});
      assert.equal((await asUser("finance","select * from complaints where id='GRV-2026-9422'")).rows.length,0);
      assert.equal((await asUser("records","select * from complaints where id='GRV-2026-9422'")).rows.length,1);
      const audit = (await db.query("select details from complaint_events where event_type='case_transfer'")).rows[0].details;
      assert.equal(audit.from_cell,"finance"); assert.equal(audit.to_cell,"records"); assert.ok(audit.reason); assert.equal(audit.actor_id,ids.finance);
      await assert.rejects(act("finance","status"),/forbidden/); tick--;
    });
    await t.test("escalation preserves current cell and admin sees it", async () => {
      await act("records","escalate",{status:"Escalated",escalation_reason:"Higher level attention is required."});
      assert.deepEqual((await asUser("admin","select cell_id,status from complaints where id='GRV-2026-9422'")).rows[0],{cell_id:"records",status:"Escalated"});
      await assert.rejects(act("records","escalate",{status:"Escalated"}),/invalid/); tick--;
    });
    await t.test("current owner resolves and student receives resolution/history", async () => {
      await act("records","resolve",{status:"Resolved",resolution:{summary:"The transcript issue has been resolved.",action:"The corrected record was supplied.",at:"2026-10-25T15:00:00Z"},resolved_at:"2026-10-25T15:00:00Z"});
      const row = (await asUser("student","select status,resolution,recommended_cell_id from complaints where id='GRV-2026-9422'")).rows[0];
      assert.equal(row.status,"Resolved"); assert.ok(row.resolution.summary); assert.equal(row.recommended_cell_id,"finance");
      assert.ok((await asUser("student","select * from complaint_events where complaint_id='GRV-2026-9422'")).rows.length >= 6);
      await assert.rejects(act("admin","status"),/finalised/); tick--;
    });
    await t.test("database rejects original recommendation mutation", async () => {
      await assert.rejects(db.query("update complaints set recommended_cell_id='records' where id='GRV-2026-9422'"),/immutable/);
    });
    await t.test("browser cannot invoke service-only action RPC", async () => {
      await assert.rejects(asUser("finance","select persist_officer_action($1,'GRV-2026-9422',now(),'{}','{}')",[ids.admin]),/permission denied/);
    });
  } finally { await db.close(); }
});
