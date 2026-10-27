import * as presentation from "../src/lib/presentation.ts";
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as authorization from "../src/lib/authorization.ts";
import * as cells from "../src/lib/cells.ts";

function load(relative, modules) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(relative, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: name => {
    if (name.endsWith(".css")) return {};
    assert.ok(name in modules, name);
    return modules[name];
  } });
  return exports;
}
for (const role of ["student", "officer", "admin"]) for (const workspace of ["student", "officer", "admin"]) {
  test(`actual server role guard: ${role} entering ${workspace}`, async () => {
    const profile = { id: "trusted", display_name: "Fixture", role, cell_id: role === "officer" ? "finance" : null };
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: "trusted" } } }) },
      from: () => ({ select: columns => { assert.ok(columns.includes("cell_id")); return { eq: () => ({ maybeSingle: async () => ({ data: profile }) }) }; } }),
    };
    const auth = load("../src/lib/supabase/auth.ts", {
      "server-only": {}, "../authorization": authorization,
      "next/navigation": { redirect: url => { throw new Error(`redirect:${url}`); } },
      "./config": { hasSupabaseConfiguration: () => true },
      "./server": { createSupabaseServerClient: async () => client },
    });
    if (role === workspace) assert.equal((await auth.requireRole([workspace])).id,"trusted");
    else await assert.rejects(auth.requireRole([workspace]),new RegExp(`redirect:/${role}/dashboard`));
  });
}
test("officer without assigned cell sees configuration state, never route content", async () => {
  const layout = load("../src/app/officer/layout.tsx", {
    "react/jsx-runtime": jsx,
    "@/lib/presentation": presentation,
    "@/lib/cells": cells,
    "@/components/officer/OfficerDemoProvider": { OfficerDemoProvider: ({children}) => children },
    "@/components/officer/OfficerNav": { OfficerNav: () => null },
    "@/lib/supabase/config": { hasSupabaseConfiguration: () => true },
    "@/lib/supabase/auth": { requireRole: async roles => { assert.deepEqual(Array.from(roles),["officer"]); return { id:"officer",role:"officer",cell_id:null }; } },
  });
  const html = renderToStaticMarkup(await layout.default({ children: "CONFIDENTIAL_QUEUE" }));
  assert.match(html,/No review cell has been assigned/);
  assert.doesNotMatch(html,/CONFIDENTIAL_QUEUE/);
});
