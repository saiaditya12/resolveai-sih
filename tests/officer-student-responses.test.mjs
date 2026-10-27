import * as presentation from "../src/lib/presentation.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { canReadComplaint } from "../src/lib/authorization.ts";
import { mapPersistentComplaint } from "../src/lib/persistence/mapper.ts";

const responseText =
  "I submitted my admission cancellation request on 10 September 2026 and received confirmation.";
const earlierResponse = {
  id: "response-1",
  complaint_id: "GRV-2026-9422",
  request_event_id: "request-1",
  response_text: "I have contacted the admissions office about this issue.",
  evidence: [],
  created_at: "2026-10-25T08:50:00Z",
};
const laterResponse = {
  id: "response-2",
  complaint_id: "GRV-2026-9422",
  request_event_id: "request-2",
  response_text: responseText,
  evidence: [
    {
      id: "file-1",
      name: "cancellation-confirmation.pdf",
      type: "application/pdf",
      size: 1024,
    },
  ],
  created_at: "2026-10-25T09:00:00Z",
};

function mapRecord(responses) {
  return mapPersistentComplaint(
    {
      id: "GRV-2026-9422",
      student_id: "student-1",
      title: "Admission cancellation refund",
      cell_id: "finance",
      submitted_at: "2026-10-20T08:00:00Z",
      updated_at: "2026-10-25T09:00:00Z",
    },
    {
      events: [
        {
          id: "request-2",
          at: "2026-10-25T08:45:00Z",
          title: "Student information requested",
          explanation: "Please provide confirmation of the cancellation request.",
          actor_type: "Officer",
        },
      ],
      responses,
    },
  );
}

const sectionsSource = readFileSync(
  new URL("../src/components/officer/OfficerCaseSections.tsx", import.meta.url),
  "utf8",
);
const sectionsOutput = ts.transpileModule(sectionsSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;
function loadResponsesPanel() {
  const exports = {};
  const modules = {
    react: {
      useEffect: () => {},
      useState: (value) => [value, () => {}],
    },
    "@/lib/demo-student": { formatDemoDate: (value) => value },
    "@/lib/complaint-tracking": {
      formatEventTime: (value) => value,
    },
    "@/lib/complaint-flow": { fileSize: (value) => `${value} bytes` },
    "@/lib/officer-model": {
      OFFICER_DEMO_CLOCK: "",
      officerCells: [],
      officerSla: () => ({}),
    },
    "@/lib/patterns/institution-patterns": {
      getInstitutionComplaintHistory: () => ({}),
    },
    "@/lib/patterns/types": { institutionPatternPolicy: {} },
    "@/lib/sla/sla": { formatDuration: () => "" },
    "@/lib/sla/policy": { prototypeSlaPolicy: {} },
    "./OfficerBadges": {
      OfficerStatus: () => null,
      PriorityBadge: () => null,
      SlaBadge: () => null,
    },
    "react/jsx-runtime": jsx,
    "@/lib/presentation": presentation,
    "@/components/ComplaintStoreProvider": {
      useComplaintStore: () => ({}),
    },
  };
  vm.runInNewContext(sectionsOutput, {
    exports,
    require(name) {
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
  });
  return exports.StudentResponsesPanel;
}

function renderResponses(item) {
  const panel = loadResponsesPanel();
  return renderToStaticMarkup(panel({ item }));
}

test("assigned cell officer sees the actual persisted response text", () => {
  const record = mapRecord([laterResponse]);
  const officer = {
    id: "officer-1",
    role: "officer",
    cell_id: "finance",
    display_name: "Finance Officer",
  };
  assert.equal(canReadComplaint(officer, record), true);
  assert.match(renderResponses(record), new RegExp(responseText));
});

test("persisted student response remains visible after refresh", () => {
  const firstLoad = mapRecord([laterResponse]);
  const refreshed = mapRecord([laterResponse]);
  assert.equal(firstLoad.studentResponses[0].text, refreshed.studentResponses[0].text);
  assert.match(renderResponses(refreshed), new RegExp(responseText));
});

test("multiple responses render chronologically with their timestamps", () => {
  const record = mapRecord([laterResponse, earlierResponse]);
  const markup = renderResponses(record);
  assert.ok(
    markup.indexOf(earlierResponse.response_text) <
      markup.indexOf(laterResponse.response_text),
  );
  assert.ok(
    markup.indexOf("2026-10-25T08:50:00Z") <
      markup.indexOf("2026-10-25T09:00:00Z"),
  );
  assert.match(markup, /Response to: Please provide confirmation/);
});

test("response evidence displays submitted metadata, not file contents", () => {
  const markup = renderResponses(mapRecord([laterResponse]));
  assert.match(markup, /cancellation-confirmation\.pdf/);
  assert.match(markup, /application\/pdf/);
  assert.doesNotMatch(markup, /data:application/);
});

test("unrelated cell officer cannot read the complaint or its response", () => {
  const record = mapRecord([laterResponse]);
  const officer = {
    id: "officer-2",
    role: "officer",
    cell_id: "records",
    display_name: "Records Officer",
  };
  assert.equal(canReadComplaint(officer, record), false);
});

test("officer direct URL denies a complaint outside the current cell", async () => {
  const pageSource = "../src/app/officer/complaints/[id]/page.tsx";
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(pageSource, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  );
  const profile = {
    id: "officer-2",
    role: "officer",
    cell_id: "records",
    display_name: "Records Officer",
  };
  let rendered = false;
  const modules = {
    "@/lib/supabase/auth": {
      requireRole: async (roles) => {
        assert.deepEqual(Array.from(roles), ["officer"]);
        return profile;
      },
    },
    "@/lib/persistence/api": {
      loadPersistentComplaint: async (_id, trustedProfile) =>
        canReadComplaint(trustedProfile, mapRecord([laterResponse]))
          ? mapRecord([laterResponse])
          : null,
    },
    "next/navigation": {
      notFound() {
        throw new Error("not-found");
      },
    },
    "@/components/officer/OfficerCase": {
      OfficerCase: () => {
        rendered = true;
        return null;
      },
    },
    "@/lib/officer-demo": { officerSeedCases: [] },
    "react/jsx-runtime": jsx,
    "@/lib/presentation": presentation,
  };
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
  });
  await assert.rejects(
    exports.default({ params: Promise.resolve({ id: "GRV-2026-9422" }) }),
    /not-found/,
  );
  assert.equal(rendered, false);
});

test("admin can read the complaint and its persisted response", () => {
  const record = mapRecord([laterResponse]);
  const admin = {
    id: "admin-1",
    role: "admin",
    cell_id: null,
    display_name: "Administrator",
  };
  assert.equal(canReadComplaint(admin, record), true);
  assert.match(renderResponses(record), new RegExp(responseText));
});

test("admin direct URL is authorized to render the complaint detail", async () => {
  const pageSource = "../src/app/admin/complaints/[id]/page.tsx";
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(pageSource, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  );
  const profile = {
    id: "admin-1",
    role: "admin",
    cell_id: null,
    display_name: "Administrator",
  };
  const modules = {
    "@/lib/supabase/auth": {
      requireRole: async (roles) => {
        assert.deepEqual(Array.from(roles), ["admin"]);
        return profile;
      },
    },
    "@/lib/persistence/api": {
      loadPersistentComplaint: async (_id, trustedProfile) =>
        canReadComplaint(trustedProfile, mapRecord([laterResponse]))
          ? mapRecord([laterResponse])
          : null,
    },
    "next/navigation": {
      notFound() {
        throw new Error("not-found");
      },
    },
    "@/components/officer/OfficerCase": { OfficerCase: "OfficerCase" },
    "@/lib/officer-demo": { officerSeedCases: [] },
    "react/jsx-runtime": jsx,
    "@/lib/presentation": presentation,
  };
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
  });
  const detail = await exports.default({
    params: Promise.resolve({ id: "GRV-2026-9422" }),
  });
  assert.equal(detail.type, "OfficerCase");
  assert.equal(detail.props.id, "GRV-2026-9422");
});

test("student response text remains separate from audit event summaries", () => {
  const record = mapRecord([laterResponse]);
  assert.equal(record.studentResponses[0].text, responseText);
  assert.equal(record.events[0].explanation, "Please provide confirmation of the cancellation request.");
  assert.notEqual(record.events[0].explanation, record.studentResponses[0].text);
  const markup = renderResponses(record);
  assert.match(markup, new RegExp(responseText));
  assert.doesNotMatch(markup, /Student response recorded/);
});
