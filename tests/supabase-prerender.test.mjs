import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { createServerClient } from "@supabase/ssr";

test("server auth client waits for a real request before reading cookies or initializing Supabase", async () => {
  const source = readFileSync(new URL("../src/lib/supabase/server.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const calls = [];
  let connect;
  const pending = new Promise((resolve) => { connect = resolve; });
  const client = { auth: {} };
  const cookieStore = { getAll: () => [], set: () => {} };
  const modules = {
    "server-only": {},
    "next/server": { connection: () => { calls.push("connection"); return pending; } },
    "next/headers": { cookies: async () => { calls.push("cookies"); return cookieStore; } },
    "./config": { getPublicSupabaseConfig: () => ({ url: "https://fixture.supabase.co", anonKey: "fixture" }) },
    "@supabase/ssr": { createServerClient: () => { calls.push("client"); return client; } },
    "@supabase/supabase-js": { createClient: () => { throw new Error("Admin client must not be used for session auth"); } },
  };
  const exports = {};
  vm.runInNewContext(outputText, { exports, require: (name) => {
    assert.ok(name in modules, `Unexpected dependency: ${name}`);
    return modules[name];
  } });
  const result = exports.createSupabaseServerClient();
  await Promise.resolve();
  assert.deepEqual(calls, ["connection"]);
  connect();
  assert.equal(await result, client);
  assert.deepEqual(calls, ["connection", "cookies", "client"]);
});

test("installed Supabase session loading reads the clock only when a session exists", async () => {
  // Synthetic session and stub transport: no credentials or real network access.
  const session = { access_token: "fixture", refresh_token: "fixture", expires_at: 4102444800, user: { id: "fixture" } };
  for (const signedIn of [false, true]) {
    const clocks = [];
    const original = Date.now;
    Date.now = () => { clocks.push(new Error().stack); return 1792886400000; };
    try {
      const client = createServerClient("https://fixture.supabase.co", "fixture", {
        cookies: {
          getAll: () => signedIn ? [{ name: "sb-fixture-auth-token", value: JSON.stringify(session) }] : [],
          setAll: () => {},
        },
        global: { fetch: async () => new Response(JSON.stringify({ id: "fixture" }), { status: 200, headers: { "content-type": "application/json" } }) },
      });
      const result = await client.auth.getUser();
      if (signedIn) {
        assert.equal(result.data.user.id, "fixture");
        assert.ok(clocks.some((stack) => stack.includes("__loadSession")));
      } else {
        assert.equal(result.data.user, null);
        assert.equal(clocks.length, 0);
      }
    } finally {
      Date.now = original;
    }
  }
});
