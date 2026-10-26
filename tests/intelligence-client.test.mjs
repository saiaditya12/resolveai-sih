import test from "node:test";
import assert from "node:assert/strict";
import { requestComplaintIntelligence } from "../src/lib/intelligence/client.ts";

const complaint = {
  title: "Admission fee refund",
  description:
    "The college has not refunded my admission fee after cancellation and I need an update.",
  institution: "Demo Institute",
};

test("client uses deterministic fallback for provider errors and invalid responses", async () => {
  const failures = [
    async () => {
      throw new Error("private provider failure");
    },
    async () => Response.json({ invalid: true }),
    async () => Response.json({ error: "unavailable" }, { status: 429 }),
  ];

  for (const fetcher of failures) {
    const result = await requestComplaintIntelligence(complaint, fetcher);
    assert.equal(result.source, "Fallback Rules");
    assert.equal(result.category, "Fees / Refund");
    assert.equal(result.recommendedCellId, "finance");
    assert.doesNotMatch(JSON.stringify(result), /private provider failure|unavailable/);
  }
});

test("client times out a stalled analysis and preserves the complaint with fallback", async () => {
  let signal;
  const result = await requestComplaintIntelligence(
    complaint,
    async (_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    },
    5,
  );

  assert.equal(signal.aborted, true);
  assert.equal(result.source, "Fallback Rules");
  assert.equal(result.recommendedCellId, "finance");
});

test("ambiguous client fallback result requires manual review without a cell", async () => {
  const result = await requestComplaintIntelligence(
    {
      title: "Please help",
      description: "Nothing is working and nobody responds.",
      institution: "Demo Institute",
    },
    async () => {
      throw new Error("network unavailable");
    },
  );

  assert.equal(result.category, "Other");
  assert.equal(result.needsManualReview, true);
  assert.equal(result.recommendedCellId, null);
  assert.equal(result.source, "Fallback Rules");
});
