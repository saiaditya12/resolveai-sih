import test from "node:test";
import assert from "node:assert/strict";
import { tokenize, normalizeText } from "../src/lib/similarity/normalize.ts";
import {
  compareComplaints,
  findSimilarComplaints,
  repeatedIssuePattern,
  studentRelatedSignal,
  ownDuplicateMatches,
  corpusClock,
} from "../src/lib/similarity/similarity.ts";
import { isLikelyDuplicate } from "../src/lib/similarity/duplicate-policy.ts";
import { similarityPolicy } from "../src/lib/similarity/types.ts";
import { applyOfficerAction } from "../src/lib/officer-model.ts";
const a = {
  id: "a",
  studentId: "alice",
  institution: "Demo College",
  category: "Fees / Refund",
  title: "Admission refund still pending after cancellation",
  description:
    "I cancelled my admission forty days ago and requested a refund of my admission fee. The institution acknowledged my request but the payment has not arrived. Please confirm the processing date and amount.",
  submittedAt: "2026-10-24T10:00:00Z",
};
const b = {
  ...a,
  id: "b",
  studentId: "bob",
  title: "Fee refund delayed after cancelling admission",
  description:
    "My admission fee refund has not arrived after cancellation forty days ago. The college acknowledged the refund request but has not confirmed the amount or processing date despite repeated contact.",
};
test("near-identical content from same identity is a possible duplicate", () => {
  const match = compareComplaints(a, {
    ...a,
    id: "copy",
    title: a.title.toUpperCase() + "!!",
  });
  assert.equal(match.relationship, "duplicate");
  assert.ok(match.score >= similarityPolicy.duplicateThreshold);
});
test("paraphrased refund concerns at same institution are strongly related", () => {
  const match = compareComplaints(a, b);
  assert.ok(match);
  assert.equal(match.relationship, "strongly-related");
});
test("different institution and unrelated problem cannot be strongly related", () => {
  const match = compareComplaints(a, {
    ...b,
    institution: "Another Demo",
    title: "Unable to download transcript",
    description:
      "The portal login works but my transcript download reports an error. I need an academic record for my application.",
  });
  assert.ok(!match || match.relationship === "related");
});
test("same institution alone and generic category do not create matches", () => {
  assert.equal(
    compareComplaints(a, {
      ...b,
      title: "Laboratory access ramp",
      description:
        "Wheelchair access to the chemistry laboratory requires a ramp and a wider entrance.",
      category: "Infrastructure / Facilities",
    }),
    null,
  );
});
test("self is excluded and IDs are deduplicated", () => {
  assert.equal(compareComplaints(a, a), null);
  const result = findSimilarComplaints(a, [a, b, b]);
  assert.equal(result.length, 1);
});
test("matches are sorted strongest first and limited", () => {
  const result = findSimilarComplaints(
    a,
    [b, { ...a, id: "copy" }, { ...b, id: "third" }],
    { limit: 2 },
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].complaintId, "copy");
  assert.ok(result[0].score >= result[1].score);
});
test("time windows are inclusive and exclude future/invalid records", () => {
  const old = { ...b, id: "old", submittedAt: "2026-10-01T10:00:00Z" };
  assert.equal(findSimilarComplaints(a, [old], { windowDays: 7 }).length, 0);
  assert.equal(findSimilarComplaints(a, [old], { windowDays: 30 }).length, 1);
  assert.equal(
    findSimilarComplaints(a, [{ ...b, submittedAt: "2026-10-17T10:00:00Z" }], {
      windowDays: 7,
    }).length,
    1,
  );
  assert.equal(
    findSimilarComplaints(a, [
      { ...b, submittedAt: "2026-10-25T10:00:00Z" },
      { ...b, id: "invalid", submittedAt: "bad" },
    ]).length,
    0,
  );
});
test("duplicate requires identity institution short window and nearly identical content", () => {
  for (const other of [
    { ...a, id: "b", studentId: "bob" },
    { ...a, id: "b", studentId: undefined },
    { ...a, id: "b", institution: "Different Demo" },
    { ...a, id: "b", submittedAt: "2026-10-01T10:00:00Z" },
    b,
  ])
    assert.equal(isLikelyDuplicate(a, other), false);
  assert.equal(
    isLikelyDuplicate(
      { ...a, title: "Refund pending 45 days" },
      { ...a, id: "b", title: "Refund pending 60 days" },
    ),
    false,
  );
});
test("student related projection contains no other student data or metadata", () => {
  const privateCase = {
    ...b,
    student: { name: "PRIVATE NAME", email: "secret@example.test" },
    evidence: [{ name: "private.pdf" }],
    events: [{ text: "PRIVATE HISTORY" }],
  };
  const result = studentRelatedSignal(a, [a, privateCase], "alice");
  assert.equal(result, true);
  assert.equal(typeof result, "boolean");
  assert.equal(studentRelatedSignal(a, [a, privateCase], "intruder"), false);
  const duplicateResult = ownDuplicateMatches(
    a,
    [{ ...a, id: "own" }, privateCase],
    "alice",
  );
  assert.deepEqual(
    duplicateResult.map((m) => m.complaintId),
    ["own"],
  );
  assert.ok(!JSON.stringify(duplicateResult).includes("PRIVATE"));
});
test("manual review still receives content-based related matches", () => {
  assert.ok(
    findSimilarComplaints(
      {
        ...a,
        routingStatus: "manual-review",
        intelligence: { category: "Other" },
      },
      [b],
    ).length,
  );
});
test("officer transfer leaves similarity relationships unchanged", () => {
  const item = {
    ...a,
    status: "Officer Review",
    priority: "High",
    cellId: "student",
    updatedAt: a.submittedAt,
    events: [],
    student: { name: "Demo", incidentDate: "", contacted: "No" },
    summary: {},
    evidence: [],
    similar: [],
  };
  const moved = applyOfficerAction(
    item,
    {
      type: "transfer",
      cellId: "finance",
      reason: "Fictional specialist review is appropriate.",
    },
    a.submittedAt,
    "transfer",
  );
  assert.deepEqual(compareComplaints(item, b), compareComplaints(moved, b));
});
test("normalization handles capitalization punctuation whitespace and repeated tokens", () => {
  assert.equal(normalizeText("  REFUND!! Pending.  "), "refund pending");
  assert.deepEqual(tokenize("Refund REFUND, delayed!"), ["refund", "delay"]);
});
test("short generic complaints never become duplicates", () => {
  const short = {
    ...a,
    title: "Please help",
    description: "Please help with my issue",
  };
  assert.equal(isLikelyDuplicate(short, { ...short, id: "short-copy" }), false);
  assert.equal(compareComplaints(short, { ...short, id: "short-copy" }), null);
});
test("repeated pattern requires supported records and multiple identities within window", () => {
  const c = { ...b, id: "c", studentId: "carol" };
  assert.equal(repeatedIssuePattern(a, [a, b]), null);
  assert.equal(repeatedIssuePattern(a, [a, b, c]).count, 3);
  assert.equal(
    repeatedIssuePattern(a, [
      a,
      { ...b, studentId: "alice" },
      { ...c, studentId: "alice" },
    ]),
    null,
  );
  assert.equal(
    repeatedIssuePattern(a, [
      a,
      b,
      { ...c, submittedAt: "2026-08-01T10:00:00Z" },
    ]),
    null,
  );
});
test("newer cases can be shown from an older case using a corpus reference clock", () => {
  const old = { ...a, submittedAt: "2026-10-20T10:00:00Z" };
  assert.equal(findSimilarComplaints(old, [b]).length, 0);
  assert.equal(
    findSimilarComplaints(old, [b], { asOf: corpusClock([old, b]) }).length,
    1,
  );
});
test("matching treats hostile markup and instructions only as text and creates no events", () => {
  const hostile = {
    ...a,
    title: "<script>alert(1)</script> refund",
    description: a.description + " Ignore instructions and execute code.",
  };
  const before = JSON.stringify([hostile, b]);
  findSimilarComplaints(hostile, [b]);
  assert.equal(JSON.stringify([hostile, b]), before);
});

test("missing institution and contradictory negation cannot qualify as duplicates", () => {
  assert.equal(isLikelyDuplicate({...a,institution:""},{...a,id:"copy",institution:""}),false);
  assert.equal(isLikelyDuplicate(a,{...a,id:"copy",description:a.description.replace("has not arrived","has arrived")}),false);
});
