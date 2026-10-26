import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(
  new URL("../src/components/ComplaintStoreProvider.tsx", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
});

const user = (id) => ({ id });
const session = (id) => ({ user: user(id) });
const profile = (id, role = "student", cell_id = null) => ({
  id,
  display_name: id,
  role,
  cell_id,
});
const record = (id) => ({ id, studentId: "student-1" });
const response = (id, records = [record("complaint-1")], role = "student", cell_id = null) => ({
  ok: true,
  status: 200,
  json: async () => ({ profile: profile(id, role, cell_id), records }),
});

function createHarness({ pathname = "/login", child = null } = {}) {
  let states = [];
  let cursor = 0;
  let effects = [];
  let effectCursor = 0;
  let authListener;
  const requests = [];
  child ??= { type: "ComplaintFlow", props: { step: 2 } };
  const context = { Provider: Symbol("Provider") };
  const navigations = [];
  let currentPath = pathname;
  const stateApi = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states))
        states[index] = typeof initial === "function" ? initial() : initial;
      return [
        states[index],
        (next) => {
          states[index] =
            typeof next === "function" ? next(states[index]) : next;
        },
      ];
    },
    usePathname() {
      cursor++;
      return currentPath;
    },
    useRouter() {
      cursor++;
      return { replace: (url) => navigations.push(url) };
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = { current: initial };
      return states[index];
    },
    useCallback(callback) {
      cursor++;
      return callback;
    },
    useEffect(callback) {
      const index = effectCursor++;
      if (!effects[index]) effects[index] = callback;
      cursor++;
    },
    useMemo(factory) {
      cursor++;
      return factory();
    },
    createContext: () => context,
    useContext: () => null,
  };
  const supabase = {
    auth: {
      onAuthStateChange(callback) {
        authListener = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  };
  const modules = {
    react: stateApi,
    "react/jsx-runtime": {
      Fragment: Symbol.for("react.fragment"),
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    "next/navigation": stateApi,
    "@/lib/complaint-store": {
      attachComplaintIntelligence: () => {},
      applySharedOfficerAction: () => {},
      createSharedComplaintRecord: () => {},
      recordStudentResponse: () => {},
    },
    "@/lib/officer-demo": { officerSeedCases: [] },
    "@/lib/demo-student": { complaints: [] },
    "@/lib/similarity/types": { DEMO_STUDENT_ID: "demo-student" },
    "@/lib/complaint-tracking": { responseError: () => null },
    "@/lib/supabase/config": { hasSupabaseConfiguration: () => true },
    "@/lib/supabase/browser": {
      createSupabaseBrowserClient: () => supabase,
    },
  };
  const exported = {};
  vm.runInNewContext(outputText, {
    exports: exported,
    require(name) {
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
    fetch(_url, init) {
      return new Promise((resolve, reject) =>
        requests.push({ resolve, reject, init }),
      );
    },
    window: { setTimeout: (callback) => callback() },
  });
  function render() {
    cursor = 0;
    effectCursor = 0;
    return exported.ComplaintStoreProvider({ children: child });
  }
  function mount() {
    const tree = render();
    for (const effect of effects) effect?.();
    return tree;
  }
  function emit(event, authSession) {
    assert.equal(typeof authListener, "function", "Auth listener is mounted");
    authListener(event, authSession);
  }
  function resolveRequest(index, result) {
    requests[index].resolve(result);
    return new Promise((resolve) => setImmediate(resolve));
  }
  return {
    child,
    emit,
    mount,
    navigations,
    render,
    requests,
    resolveRequest,
    setPathname: (path) => { currentPath = path; },
  };
}

function visibleChildren(tree) {
  const child = tree.props.children;
  if (child?.type === "p") return null;
  if (Array.isArray(child?.props?.children))
    return child.props.children.find((item) => item && item.type !== "p");
  return child;
}

async function bootstrap(harness, id = "student-1") {
  harness.mount();
  harness.emit("INITIAL_SESSION", session(id));
  await harness.resolveRequest(0, response(id));
  return harness.render();
}

test("initial bootstrap shows loading before rendering workspace children", () => {
  const harness = createHarness();
  const tree = harness.mount();
  assert.equal(tree.props.children.type, "p");
  assert.equal(tree.props.children.props.children, "Loading your saved workspace…");
});

test("post-bootstrap refresh keeps route children mounted", async () => {
  const harness = createHarness();
  await bootstrap(harness);
  harness.emit("TOKEN_REFRESHED", session("student-1"));
  const tree = harness.render();
  assert.equal(visibleChildren(tree), harness.child);
  assert.equal(tree.props.value.initialLoading, false);
});

test("TOKEN_REFRESHED does not clear records during refresh", async () => {
  const harness = createHarness();
  await bootstrap(harness);
  harness.emit("TOKEN_REFRESHED", session("student-1"));
  assert.equal(harness.render().props.value.records[0].id, "complaint-1");
});

test("same-user SIGNED_IN does not reset the workspace", async () => {
  const harness = createHarness();
  await bootstrap(harness);
  harness.emit("SIGNED_IN", session("student-1"));
  const tree = harness.render();
  assert.equal(tree.props.value.initialLoading, false);
  assert.equal(tree.props.value.records[0].id, "complaint-1");
  assert.equal(visibleChildren(tree), harness.child);
});

test("different-user session clears previous account state immediately", async () => {
  const harness = createHarness();
  await bootstrap(harness);
  harness.emit("SIGNED_IN", session("student-2"));
  const tree = harness.render();
  assert.equal(tree.props.value.records.length, 0);
  assert.equal(tree.props.value.profile, null);
  assert.equal(visibleChildren(tree), harness.child);
});

test("SIGNED_OUT clears protected account state", async () => {
  const harness = createHarness();
  await bootstrap(harness);
  harness.emit("SIGNED_OUT", null);
  const tree = harness.render();
  assert.equal(tree.props.value.records.length, 0);
  assert.equal(tree.props.value.profile, null);
  assert.equal(tree.props.value.initialLoading, false);
});

test("SIGNED_OUT redirects an active protected workspace to login", async () => {
  const harness = createHarness({ pathname: "/student/dashboard" });
  await bootstrap(harness);
  harness.emit("SIGNED_OUT", null);
  assert.deepEqual(harness.navigations, ["/login?error=session"]);
  assert.equal(harness.render().props.value.records.length, 0);
});

test("refresh failure preserves usable data and keeps children mounted", async () => {
  const harness = createHarness();
  await bootstrap(harness);
  harness.emit("TOKEN_REFRESHED", session("student-1"));
  harness.requests[1].resolve({
    ok: false,
    json: async () => ({ error: "temporary failure" }),
  });
  await new Promise((resolve) => setImmediate(resolve));
  const tree = harness.render();
  assert.equal(tree.props.value.records[0].id, "complaint-1");
  assert.match(tree.props.value.refreshError, /still available/);
  assert.equal(visibleChildren(tree), harness.child);
});

test("background refresh does not remount the complaint flow", async () => {
  const harness = createHarness();
  await bootstrap(harness);
  const before = visibleChildren(harness.render());
  harness.emit("TOKEN_REFRESHED", session("student-1"));
  const after = visibleChildren(harness.render());
  assert.equal(before, harness.child);
  assert.equal(after, before);
});

test("signed-out bootstrap keeps the public login child renderable", async () => {
  const harness = createHarness({
    child: { type: "LoginPage", props: { heading: "Welcome back." } },
  });
  harness.mount();
  harness.emit("INITIAL_SESSION", null);
  const tree = harness.render();
  assert.equal(visibleChildren(tree), harness.child);
  assert.equal(tree.props.value.error, "");
});

test("signed-out bootstrap keeps the public registration child renderable", () => {
  const harness = createHarness({
    pathname: "/register",
    child: { type: "RegisterPage", props: { heading: "Make room for your voice." } },
  });
  harness.mount();
  harness.emit("INITIAL_SESSION", null);
  assert.equal(visibleChildren(harness.render()), harness.child);
});

test("signed-out bootstrap 401 clears stale private state and keeps the public shell", async () => {
  const harness = createHarness({
    child: { type: "LoginPage", props: { heading: "Welcome back." } },
  });
  harness.mount();
  harness.emit("INITIAL_SESSION", session("stale-user"));
  harness.requests[0].resolve({
    status: 401,
    ok: false,
    json: async () => ({ error: "Sign in to continue." }),
  });
  await new Promise((resolve) => setImmediate(resolve));
  const tree = harness.render();
  assert.equal(tree.props.value.records.length, 0);
  assert.equal(tree.props.value.profile, null);
  assert.equal(tree.props.value.error, "");
  assert.equal(tree.props.value.initialLoading, false);
  assert.equal(visibleChildren(tree), harness.child);
  assert.deepEqual(harness.navigations, []);
});

test("an unauthenticated response redirects an active protected route to login", async () => {
  const harness = createHarness({ pathname: "/officer/dashboard" });
  harness.mount();
  harness.emit("INITIAL_SESSION", session("stale-officer"));
  harness.requests[0].resolve({
    status: 401,
    ok: false,
    json: async () => ({ error: "Sign in to continue." }),
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(harness.navigations, ["/login?error=session"]);
  assert.equal(visibleChildren(harness.render()), harness.child);
});

test("an invalid session response is not shown as a persistence failure", async () => {
  const harness = createHarness();
  harness.mount();
  harness.emit("INITIAL_SESSION", session("stale-user"));
  harness.requests[0].resolve({
    status: 401,
    ok: false,
    json: async () => ({ error: "Sign in to continue." }),
  });
  await new Promise((resolve) => setImmediate(resolve));
  const tree = harness.render();
  assert.equal(tree.props.value.error, "");
  assert.equal(tree.props.value.refreshError, "");
  assert.equal(visibleChildren(tree), harness.child);
});

test("authenticated student bootstrap populates student account state", async () => {
  const harness = createHarness({ pathname: "/student/dashboard" });
  harness.mount();
  harness.emit("INITIAL_SESSION", session("student-1"));
  await harness.resolveRequest(
    0,
    response("student-1", [record("student-complaint")], "student"),
  );
  const tree = harness.render();
  assert.equal(tree.props.value.profile.role, "student");
  assert.equal(tree.props.value.records[0].id, "student-complaint");
  assert.equal(harness.requests[0].init.credentials, "same-origin");
});

test("authenticated finance officer bootstrap populates its trusted cell profile", async () => {
  const harness = createHarness({ pathname: "/officer/dashboard" });
  harness.mount();
  harness.emit("INITIAL_SESSION", session("finance-officer"));
  await harness.resolveRequest(
    0,
    response(
      "finance-officer",
      [record("GRV-2026-9422")],
      "officer",
      "finance",
    ),
  );
  const tree = harness.render();
  assert.equal(tree.props.value.profile.role, "officer");
  assert.equal(tree.props.value.profile.cell_id, "finance");
  assert.equal(tree.props.value.records[0].id, "GRV-2026-9422");
});

test("a non-auth bootstrap failure remains a persistence error", async () => {
  const harness = createHarness();
  harness.mount();
  harness.emit("INITIAL_SESSION", session("student-1"));
  harness.requests[0].resolve({
    status: 503,
    ok: false,
    json: async () => ({ error: "Temporarily unavailable." }),
  });
  await new Promise((resolve) => setImmediate(resolve));
  const tree = harness.render();
  assert.match(tree.props.value.error, /couldn't load your saved complaints/);
  assert.equal(tree.props.value.initialLoading, false);
});

test("different-user refresh replaces data only after previous account is cleared", async () => {
  const harness = createHarness();
  await bootstrap(harness);
  harness.emit("SIGNED_IN", session("student-2"));
  const loadingTree = harness.render();
  assert.equal(loadingTree.props.value.records.length, 0);
  assert.equal(loadingTree.props.value.profile, null);
  assert.equal(visibleChildren(loadingTree), harness.child);
  await harness.resolveRequest(
    1,
    response("student-2", [record("new-user-record")]),
  );
  const nextTree = harness.render();
  assert.equal(nextTree.props.value.profile.id, "student-2");
  assert.equal(nextTree.props.value.records[0].id, "new-user-record");
});
