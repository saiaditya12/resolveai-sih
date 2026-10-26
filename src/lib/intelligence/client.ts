import type { ComplaintAnalysisInput } from "./input";
import { classifyComplaintFallback } from "./fallback.ts";
import { validateComplaintIntelligenceResult } from "./schema.ts";
import type { ComplaintIntelligenceResult } from "./types.ts";

export const COMPLAINT_ANALYSIS_TIMEOUT_MS = 25_000;

function offlineManualReviewResult(
  analyzedAt: string,
): ComplaintIntelligenceResult {
  return validateComplaintIntelligenceResult({
    summary: "Complaint analysis is unavailable; an officer must review it.",
    category: "Other",
    subcategory: "",
    priority: "Medium",
    urgencyReason:
      "Automated analysis could not be completed; manual review is required.",
    recommendedCellId: null,
    recommendedCellName: null,
    routingReason:
      "No category-specific prototype route was selected because analysis was unavailable.",
    confidence: 0.35,
    reviewRecommended: false,
    needsManualReview: true,
    manualReviewReason:
      "Automated analysis was unavailable and no deterministic fallback result could be validated.",
    source: "Manual Review",
    analyzedAt,
  });
}

export async function requestComplaintIntelligence(
  complaint: ComplaintAnalysisInput,
  fetcher: typeof fetch = fetch,
  timeoutMs = COMPLAINT_ANALYSIS_TIMEOUT_MS,
): Promise<ComplaintIntelligenceResult> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error("Complaint analysis timed out."));
      }, timeoutMs);
    });
    const response = await Promise.race([
      fetcher("/api/intelligence/analyze-complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(complaint),
        signal: controller.signal,
      }),
      timeout,
    ]);
    if (!response.ok) throw new Error("Analysis request was not accepted.");
    return validateComplaintIntelligenceResult(await response.json());
  } catch {
    const analyzedAt = new Date().toISOString();
    try {
      const result = classifyComplaintFallback({
        title: complaint.title,
        description: complaint.description,
        analyzedAt,
      });
      return validateComplaintIntelligenceResult({
        ...result,
        source: "Fallback Rules",
      });
    } catch {
      return offlineManualReviewResult(analyzedAt);
    }
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
