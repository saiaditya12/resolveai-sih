import type { ComplaintPriority } from "../officer-model.ts";
import type { ComplaintCategory } from "./categories.ts";

export type ComplaintIntelligenceSource =
  | "Fallback Rules"
  | "AI"
  | "Manual Review";

export interface ComplaintIntelligenceResult {
  summary: string;
  category: ComplaintCategory;
  subcategory: string;
  priority: ComplaintPriority;
  urgencyReason: string;
  recommendedCellId: string | null;
  recommendedCellName: string | null;
  routingReason: string;
  confidence: number;
  reviewRecommended: boolean;
  needsManualReview: boolean;
  manualReviewReason: string | null;
  source: ComplaintIntelligenceSource;
  analyzedAt: string;
}
