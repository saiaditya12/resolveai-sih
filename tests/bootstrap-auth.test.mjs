import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as authorization from "../src/lib/authorization.ts";
import * as cells from "../src/lib/cells.ts";

function load(relativePath, modules) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
    Response,
  });
  return exports;
}

function authHarness({ user, userError, profile, profileError } = {}) {
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: user ?? null },
        error: userError ?? null,
      }),
    },
  };
  const admin = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: profile ?? null,
            error: profileError ?? null,
          }),
        }),
      }),
    }),
  };
  return load("../src/lib/supabase/auth.ts", {
    "server-only": {},
    "../authorization": authorization,
    "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
    "./config": { hasSupabaseConfiguration: () => true },
    "./server": {
      createSupabaseServerClient: async () => client,
      createSupabaseAdminClient: () => admin,
    },
  });
}

test("missing auth session is classified as unauthenticated", async () => {
  const auth = authHarness({});
  const result = await auth.authenticateApiRequest();
  assert.equal(result.status, 401);
  assert.equal(result.error, "Sign in to continue.");
});

test("Supabase bad_jwt response is treated as a rejected session", async () => {
  const auth = authHarness({
    userError: { name: "AuthApiError", code: "bad_jwt", status: 403 },
  });
  const result = await auth.authenticateApiRequest();
  assert.equal(result.status, 401);
  assert.equal(result.profile, null);
});

test("Supabase auth service failure is not mislabeled as signed out", async () => {
  const auth = authHarness({
    userError: { name: "AuthRetryableFetchError", status: 503 },
  });
  const result = await auth.authenticateApiRequest();
  assert.equal(result.status, 503);
  assert.match(result.error, /temporarily unavailable/);
});

test("profile lookup failure remains a server failure, not a 401", async () => {
  const auth = authHarness({
    user: { id: "student-1" },
    profileError: { message: "database unavailable" },
  });
  const result = await auth.authenticateApiRequest();
  assert.equal(result.status, 503);
});

test("missing trusted profile is denied without being reported as signed out", async () => {
  const auth = authHarness({ user: { id: "missing-profile" } });
  const result = await auth.authenticateApiRequest();
  assert.equal(result.status, 403);
});

test("trusted finance officer profile is resolved from the server-side session", async () => {
  const profile = {
    id: "finance-officer",
    display_name: "Finance Officer",
    role: "officer",
    cell_id: "finance",
  };
  const auth = authHarness({
    user: { id: profile.id },
    profile,
  });
  const result = await auth.authenticateApiRequest();
  assert.equal(result.profile.id, profile.id);
  assert.equal(result.profile.cell_id, "finance");
});

test("API role guard preserves unauthenticated and server failure statuses", async () => {
  for (const [status, error] of [
    [401, "Sign in to continue."],
    [503, "Authentication is temporarily unavailable."],
  ]) {
    const api = load("../src/lib/persistence/api.ts", {
      "server-only": {},
      "../authorization": authorization,
      "../cells": cells,
      "node:crypto": { randomInt: () => 1000, randomUUID: () => "event" },
      "@/lib/supabase/auth": {
        authenticateApiRequest: async () => ({
          profile: null,
          error,
          status,
        }),
      },
      "@/lib/supabase/server": {
        createSupabaseAdminClient: () => ({}),
        hasSupabaseAdminConfiguration: () => true,
      },
      "./mapper": { mapPersistentComplaint: (row) => row },
    });
    const result = await api.requireApiRole(["student", "officer"]);
    assert.equal(result.error.status, status);
    assert.equal((await result.error.json()).error, error);
  }
});

test("authenticated finance officer complaint loading is cell-scoped", async () => {
  const fixtures = [
    { id: "GRV-2026-9422", student_id: "student-1", cell_id: "finance" },
    { id: "OTHER-CELL", student_id: "student-2", cell_id: "records" },
  ];
  const client = {
    from(table) {
      const filters = [];
      const rows = table === "complaints" ? fixtures : [];
      const query = {
        select: () => query,
        eq(column, value) {
          filters.push((item) => item[column] === value);
          return query;
        },
        in(column, values) {
          filters.push((item) => values.includes(item[column]));
          return query;
        },
        order: async () => ({
          data: rows.filter((item) => filters.every((filter) => filter(item))),
          error: null,
        }),
        then(resolve, reject) {
          return Promise.resolve({
            data: rows.filter((item) => filters.every((filter) => filter(item))),
            error: null,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const api = load("../src/lib/persistence/api.ts", {
    "server-only": {},
    "../authorization": authorization,
    "../cells": cells,
    "node:crypto": { randomInt: () => 1000, randomUUID: () => "event" },
    "@/lib/supabase/auth": { authenticateApiRequest: async () => ({}) },
    "@/lib/supabase/server": {
      createSupabaseAdminClient: () => client,
      hasSupabaseAdminConfiguration: () => true,
    },
    "./mapper": { mapPersistentComplaint: (row) => row },
  });
  const result = await api.loadPersistentComplaints({
    id: "finance-officer",
    display_name: "Finance Officer",
    role: "officer",
    cell_id: "finance",
  });
  assert.deepEqual(result.map((item) => item.id), ["GRV-2026-9422"]);
});
