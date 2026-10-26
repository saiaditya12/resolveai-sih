import { randomUUID } from "node:crypto";
import { officerCells, priorityRank } from "../officer-model.ts";
import {
  classifyComplaintFallback,
  determinePriority,
  evaluateConfidence,
} from "./fallback.ts";
import { isComplaintCategory } from "./categories.ts";
import type { ComplaintAnalysisInput } from "./input.ts";
import { DEFAULT_GROQ_MODEL } from "./provider-config.ts";
import { resolveRouting } from "./routing-config.ts";
import { validateComplaintIntelligenceResult } from "./schema.ts";
import type { ComplaintIntelligenceResult } from "./types.ts";

interface ModelRecommendation {
  summary: string;
  category: unknown;
  subcategory: string;
  priority: unknown;
  urgencyReason: string;
  recommendedCellId: unknown;
  routingReason: string;
  confidence: unknown;
}

export type ComplaintAnalysisProvider = (
  complaint: ComplaintAnalysisInput,
  options: { apiKey: string; model: string },
) => Promise<unknown>;

export interface AnalyzeComplaintOptions {
  apiKey?: string;
  model?: string;
  analyzedAt?: Date;
  requestId?: string;
  provider?: ComplaintAnalysisProvider;
}

function requireBoundedString(
  value: unknown,
  field: string,
  maxLength: number,
  allowEmpty = false,
): string {
  if (
    typeof value !== "string" ||
    value.length > maxLength ||
    (!allowEmpty && !value.trim())
  )
    throw new TypeError(`Invalid model result: ${field}.`);
  return value.trim();
}

function parseModelRecommendation(value: unknown): ModelRecommendation {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new TypeError("Invalid model result: expected an object.");

  const record = value as Record<string, unknown>;
  const expectedFields = [
    "summary",
    "category",
    "subcategory",
    "priority",
    "urgencyReason",
    "recommendedCellId",
    "routingReason",
    "confidence",
  ];
  if (
    Object.keys(record).length !== expectedFields.length ||
    expectedFields.some((field) => !(field in record))
  )
    throw new TypeError("Invalid model result: fields do not match the schema.");
  if (!isComplaintCategory(record.category))
    throw new TypeError("Invalid model result: category.");
  if (
    typeof record.priority !== "string" ||
    !Object.hasOwn(priorityRank, record.priority)
  )
    throw new TypeError("Invalid model result: priority.");
  if (
    typeof record.confidence !== "number" ||
    !Number.isFinite(record.confidence) ||
    record.confidence < 0 ||
    record.confidence > 1
  )
    throw new TypeError("Invalid model result: confidence.");
  if (
    record.recommendedCellId !== null &&
    (typeof record.recommendedCellId !== "string" ||
      !officerCells.some((cell) => cell.id === record.recommendedCellId))
  )
    throw new TypeError("Invalid model result: recommendedCellId.");

  return {
    summary: requireBoundedString(record.summary, "summary", 500),
    category: record.category,
    subcategory: requireBoundedString(
      record.subcategory,
      "subcategory",
      100,
      true,
    ),
    priority: record.priority,
    urgencyReason: requireBoundedString(
      record.urgencyReason,
      "urgencyReason",
      500,
    ),
    recommendedCellId: record.recommendedCellId,
    routingReason: requireBoundedString(
      record.routingReason,
      "routingReason",
      500,
    ),
    confidence: record.confidence,
  };
}

function fallback(
  complaint: ComplaintAnalysisInput,
  analyzedAt: string,
): ComplaintIntelligenceResult {
  const result = classifyComplaintFallback({
    title: complaint.title,
    description: complaint.description,
    analyzedAt,
  });
  return validateComplaintIntelligenceResult({
    ...result,
    source: "Fallback Rules",
  });
}

function logResult(
  requestId: string,
  result: ComplaintIntelligenceResult,
  startedAt: number,
  fallbackUsed: boolean,
): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[complaint-intelligence]", {
    requestId,
    source: result.source,
    category: result.category,
    priority: result.priority,
    recommendedCellId: result.recommendedCellId,
    confidence: result.confidence,
    fallbackUsed,
    latencyMs: Date.now() - startedAt,
  });
}

export async function analyzeComplaint(
  complaint: ComplaintAnalysisInput,
  options: AnalyzeComplaintOptions = {},
): Promise<ComplaintIntelligenceResult> {
  const startedAt = Date.now();
  const requestId = options.requestId ?? randomUUID();
  const analysisTimestamp = () =>
    (options.analyzedAt ?? new Date()).toISOString();
  const apiKey = options.apiKey ?? process.env.GROQ_API_KEY;

  if (!apiKey) {
    const result = fallback(complaint, analysisTimestamp());
    logResult(requestId, result, startedAt, true);
    return result;
  }

  try {
    const providerModule = options.provider
      ? undefined
      : await import("./provider.ts");
    const provider =
      options.provider ?? providerModule!.requestComplaintAnalysis;
    const model =
      options.model ??
      process.env.GROQ_MODEL ??
      DEFAULT_GROQ_MODEL;
    const recommendation = parseModelRecommendation(
      await provider(complaint, { apiKey, model }),
    );
    const analyzedAt = analysisTimestamp();
    const routing = resolveRouting(
      recommendation.category as string,
      recommendation.recommendedCellId as string | null,
    );
    if (
      (recommendation.category === "Other" &&
        recommendation.recommendedCellId !== null) ||
      (recommendation.category !== "Other" && routing.needsManualReview)
    )
      throw new TypeError("Model cell does not match the prototype mapping.");

    const confidencePolicy = evaluateConfidence(
      recommendation.confidence as number,
      recommendation.category as string,
      routing.recommendedCellId,
    );
    const needsManualReview =
      routing.needsManualReview || confidencePolicy.needsManualReview;
    const deterministicPriority = determinePriority(
      complaint.title,
      complaint.description,
    );
    const priority = deterministicPriority.priority;

    const result = validateComplaintIntelligenceResult({
      summary: recommendation.summary,
      category: recommendation.category,
      subcategory: recommendation.subcategory,
      priority,
      urgencyReason: deterministicPriority.urgencyReason,
      recommendedCellId: needsManualReview
        ? null
        : routing.recommendedCellId,
      recommendedCellName: needsManualReview
        ? null
        : routing.recommendedCellName,
      routingReason: needsManualReview
        ? routing.routingReason
        : confidencePolicy.reviewRecommended
          ? `${routing.routingReason} Confidence is 0.60–0.79; officer review is recommended.`
          : routing.routingReason,
      confidence: recommendation.confidence,
      reviewRecommended: confidencePolicy.reviewRecommended,
      needsManualReview,
      manualReviewReason: needsManualReview
        ? (confidencePolicy.manualReviewReason ??
          routing.manualReviewReason ??
          "Officer review is required.")
        : null,
      source: "AI",
      analyzedAt,
    });
    logResult(requestId, result, startedAt, false);
    return result;
  } catch {
    const result = fallback(complaint, analysisTimestamp());
    logResult(requestId, result, startedAt, true);
    return result;
  }
}
