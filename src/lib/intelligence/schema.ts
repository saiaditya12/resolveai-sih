import {
  officerCells,
  type ComplaintPriority,
} from "../officer-model.ts";
import { isComplaintCategory } from "./categories.ts";
import { routingConfig } from "./routing-config.ts";
import type {
  ComplaintIntelligenceResult,
  ComplaintIntelligenceSource,
} from "./types";

const priorities: ComplaintPriority[] = ["Low", "Medium", "High", "Critical"];
const sources: ComplaintIntelligenceSource[] = [
  "Fallback Rules",
  "AI",
  "Manual Review",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
  value: unknown,
  field: string,
  allowEmpty = false,
): string {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0))
    throw new TypeError(`Invalid complaint intelligence result: ${field}.`);
  return value;
}

export function validateComplaintIntelligenceResult(
  value: unknown,
): ComplaintIntelligenceResult {
  if (!isRecord(value))
    throw new TypeError("Invalid complaint intelligence result: expected an object.");

  if (!isComplaintCategory(value.category))
    throw new TypeError("Invalid complaint intelligence result: category.");
  if (
    typeof value.priority !== "string" ||
    !priorities.includes(value.priority as ComplaintPriority)
  )
    throw new TypeError("Invalid complaint intelligence result: priority.");
  if (
    typeof value.confidence !== "number" ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1
  )
    throw new TypeError("Invalid complaint intelligence result: confidence.");
  if (typeof value.reviewRecommended !== "boolean")
    throw new TypeError(
      "Invalid complaint intelligence result: reviewRecommended.",
    );
  if (typeof value.needsManualReview !== "boolean")
    throw new TypeError(
      "Invalid complaint intelligence result: needsManualReview.",
    );
  if (
    typeof value.source !== "string" ||
    !sources.includes(value.source as ComplaintIntelligenceSource)
  )
    throw new TypeError("Invalid complaint intelligence result: source.");

  const recommendedCellId =
    value.recommendedCellId === null
      ? null
      : requireString(value.recommendedCellId, "recommendedCellId");
  const recommendedCellName =
    value.recommendedCellName === null
      ? null
      : requireString(value.recommendedCellName, "recommendedCellName");
  const cell = recommendedCellId
    ? officerCells.find((item) => item.id === recommendedCellId)
    : undefined;

  if (
    (recommendedCellId !== null && !cell) ||
    (recommendedCellId === null && recommendedCellName !== null) ||
    (cell && recommendedCellName !== cell.name)
  )
    throw new TypeError(
      "Invalid complaint intelligence result: recommended cell is not allowed or does not match.",
    );

  const manualReviewReason =
    value.manualReviewReason === null
      ? null
      : requireString(value.manualReviewReason, "manualReviewReason");
  if (value.needsManualReview !== (manualReviewReason !== null))
    throw new TypeError(
      "Invalid complaint intelligence result: manual review reason is inconsistent.",
    );
  if (
    value.category === "Other" &&
    (!value.needsManualReview || recommendedCellId !== null)
  )
    throw new TypeError(
      "Invalid complaint intelligence result: Other must require manual review.",
    );
  if (
    value.needsManualReview &&
    recommendedCellId !== null
  )
    throw new TypeError(
      "Invalid complaint intelligence result: manual review must not include an assigned cell.",
    );
  if (!value.needsManualReview && value.source === "Manual Review")
    throw new TypeError(
      "Invalid complaint intelligence result: Manual Review source must require manual review.",
    );
  if (!value.needsManualReview && !recommendedCellId)
    throw new TypeError(
      "Invalid complaint intelligence result: routed result has no allowed cell.",
    );
  if (
    !value.needsManualReview &&
    recommendedCellId !== routingConfig[value.category]
  )
    throw new TypeError(
      "Invalid complaint intelligence result: cell does not match the category's prototype mapping.",
    );

  const expectedReviewRecommendation =
    value.confidence >= 0.6 && value.confidence < 0.8;
  if (value.reviewRecommended !== expectedReviewRecommendation)
    throw new TypeError(
      "Invalid complaint intelligence result: review recommendation conflicts with confidence.",
    );

  const analyzedAt = requireString(value.analyzedAt, "analyzedAt");
  if (Number.isNaN(Date.parse(analyzedAt)))
    throw new TypeError("Invalid complaint intelligence result: analyzedAt.");

  return {
    summary: requireString(value.summary, "summary"),
    category: value.category,
    subcategory: requireString(value.subcategory, "subcategory", true),
    priority: value.priority as ComplaintPriority,
    urgencyReason: requireString(value.urgencyReason, "urgencyReason"),
    recommendedCellId,
    recommendedCellName,
    routingReason: requireString(value.routingReason, "routingReason"),
    confidence: value.confidence,
    reviewRecommended: value.reviewRecommended,
    needsManualReview: value.needsManualReview,
    manualReviewReason,
    source: value.source as ComplaintIntelligenceSource,
    analyzedAt,
  };
}
