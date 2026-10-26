import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { toStudentComplaint } from "../src/lib/complaint-store.ts";

const source = readFileSync(
  new URL("../src/components/complaints/ComplaintDetail.tsx", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
});

function makeRecord(studentId = "student-1") {
  return {
    id: "GRV-2026-9422",
    studentId,
    institution: "Sample University",
    title: "Delayed fee refund",
    category: "Fees / Refund",
    status: "Student Action Required",
    updatedAt: "2026-10-25T08:00:00Z",
    submittedAt: "2026-10-20T08:00:00Z",
    dueAt: "",
    description: "The refund remains pending.",
    priority: "Medium",
    cellId: "finance",
    student: { name: "Student", incidentDate: "", contacted: "No" },
    summary: {
      text: "A refund is pending.",
      source: "Fixture",
      suggestion: "Review.",
      reason: "Fixture.",
    },
    evidence: [],
    events: [
      {
        id: "event-request",
        at: "2026-10-24T08:00:00Z",
        title: "Information requested",
        explanation: "Please provide the receipt.",
        actor: "Finance Cell",
      },
    ],
    similar: [],
    incidentDate: "",
    contacted: "no",
    contactDate: "",
    response: "",
    recommendedCellId: "finance",
    routingStatus: "routed",
    overriddenByOfficer: false,
    request: { recipient: "Student", text: "Please provide the receipt.", dueDate: "" },
    resolution: undefined,
    trackingResponse: {
      id: "response-1",
      at: "2026-10-25T08:30:00Z",
      text: "Here is the requested receipt information.",
      evidence: [],
    },
  };
}

function loadComplaintDetail({ store, demo }) {
  const stubs = Object.fromEntries(
    [
      "ComplaintHeader",
      "ComplaintUnderstanding",
      "ComplaintTimeline",
      "NextActionCard",
      "CurrentOwnerCard",
      "SlaStatus",
      "CaseEvents",
      "EvidenceHistory",
      "OriginalComplaint",
      "ResolvedState",
      "StudentSimilarityNotice",
      "StudentActionPanel",
    ].map((name) => [name, name]),
  );
  const modules = {
    react: {
      useState: (value) => [value, () => {}],
      useLayoutEffect: () => {},
      useEffect: () => {},
      useRef: (current) => ({ current }),
    },
    "react/jsx-runtime": {
      Fragment: Symbol.for("react.fragment"),
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    "next/link": { default: "Link" },
    "@/components/student/StudentDemoProvider": {
      useStudentDemo: () => demo,
    },
    "@/components/ComplaintStoreProvider": {
      useComplaintStore: () => store,
    },
    "@/lib/complaint-tracking": {
      getTracking: (complaint, local) => ({ complaint, local }),
    },
    "@/components/tracking/TrackingSections": stubs,
    "./SimilarityNotice": { StudentSimilarityNotice: stubs.StudentSimilarityNotice },
    "@/components/tracking/StudentActionPanel": {
      StudentActionPanel: stubs.StudentActionPanel,
    },
    "@/lib/complaint-store": { toStudentComplaint },
  };
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
  });
  return exports.ComplaintDetail;
}

function treeFor(store, demo, id = "GRV-2026-9422") {
  return loadComplaintDetail({ store, demo })({ id });
}

function findElement(tree, type) {
  if (!tree || typeof tree !== "object") return undefined;
  if (tree.type === type) return tree;
  const children = tree.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const match = findElement(child, type);
    if (match) return match;
  }
  return undefined;
}

function demoState(complaints = []) {
  return {
    complaints,
    localComplaints: [],
    trackingSessions: {},
    respond: async () => {},
    giveFeedback: () => {},
  };
}

test("persisted student complaint opens from account-scoped provider records", () => {
  const record = makeRecord();
  const complaint = toStudentComplaint(record);
  const tree = treeFor(
    {
      mode: "persistent",
      records: [record],
      profile: { id: "student-1", role: "student" },
      initialLoading: false,
    },
    demoState(),
  );
  const header = findElement(tree, "ComplaintHeader");
  const events = findElement(tree, "CaseEvents");
  assert.equal(header.props.complaint.id, "GRV-2026-9422");
  assert.equal(header.props.complaint.title, "Delayed fee refund");
  assert.equal(events.props.data.local.id, complaint.id);
  assert.equal(events.props.data.local.events[0].title, "Information requested");
  assert.equal(
    events.props.data.local.trackingResponse.text,
    "Here is the requested receipt information.",
  );
  assert.equal(tree.type, "article");
});

test("refreshing the detail route still resolves the persisted complaint", () => {
  const record = makeRecord();
  const view = () =>
    treeFor(
      {
        mode: "persistent",
        records: [record],
        profile: { id: "student-1", role: "student" },
        initialLoading: false,
      },
      demoState(),
    );
  assert.equal(findElement(view(), "ComplaintHeader").props.complaint.id, record.id);
  assert.equal(findElement(view(), "ComplaintHeader").props.complaint.id, record.id);
});

test("pending bootstrap renders loading, not a permanent not-found state", () => {
  const tree = treeFor(
    {
      mode: "persistent",
      records: [],
      profile: null,
      initialLoading: true,
    },
    demoState(),
  );
  assert.equal(tree.type, "section");
  assert.equal(tree.props["aria-busy"], "true");
  assert.equal(findElement(tree, "h1").props.children, "Loading your complaint…");
  assert.equal(findElement(tree, "CaseEvents"), undefined);
});

test("a complaint owned by another student remains inaccessible", () => {
  const tree = treeFor(
    {
      mode: "persistent",
      records: [makeRecord("student-2")],
      profile: { id: "student-1", role: "student" },
      initialLoading: false,
    },
    demoState([
      { id: "GRV-2026-9422", title: "untrusted demo-context record" },
    ]),
  );
  assert.equal(tree.type, "section");
  assert.equal(findElement(tree, "ComplaintHeader"), undefined);
  assert.equal(
    findElement(tree, "h1").props.children,
    "This complaint isn’t available in your account.",
  );
});

test("a missing trusted student profile cannot expose persistent records", () => {
  const tree = treeFor(
    {
      mode: "persistent",
      records: [makeRecord()],
      profile: null,
      initialLoading: false,
    },
    demoState(),
  );
  assert.equal(findElement(tree, "ComplaintHeader"), undefined);
});
