import { officerCells } from "../officer-model.ts";
import {
  isComplaintCategory,
  type ComplaintCategory,
} from "./categories.ts";

export const routingConfig = {
  "Fees / Refund": "finance",
  "Student Records": "records",
  "Scholarship / Financial Support": "student",
  "Academic Issue": "student",
  "Faculty / Staff Conduct": "student",
  "Infrastructure / Facilities": "student",
  "Approval / Recognition": "approval",
  Other: null,
} as const satisfies Record<ComplaintCategory, string | null>;

export interface RoutingResolution {
  recommendedCellId: string | null;
  recommendedCellName: string | null;
  routingReason: string;
  needsManualReview: boolean;
  manualReviewReason: string | null;
}

export function resolveRouting(
  category: string,
  candidateCellId?: string | null,
): RoutingResolution {
  if (!isComplaintCategory(category)) {
    return {
      recommendedCellId: null,
      recommendedCellName: null,
      routingReason:
        "The category is not recognized; prototype routing was not selected.",
      needsManualReview: true,
      manualReviewReason: "The complaint category is unknown.",
    };
  }

  if (category === "Other") {
    return {
      recommendedCellId: null,
      recommendedCellName: null,
      routingReason:
        "Other complaints require manual review; there is no prototype cell mapping.",
      needsManualReview: true,
      manualReviewReason: "No supported category-specific route was identified.",
    };
  }

  const expectedCellId = routingConfig[category];
  const cellId = candidateCellId === undefined ? expectedCellId : candidateCellId;
  const cell = officerCells.find((item) => item.id === cellId);

  if (!cell || cellId !== expectedCellId) {
    return {
      recommendedCellId: null,
      recommendedCellName: null,
      routingReason: !cell
        ? "The configured cell is not an allowed demo cell; prototype routing was not selected."
        : "The cell does not match the configured prototype mapping; routing was not selected.",
      needsManualReview: true,
      manualReviewReason: !cell
        ? "The recommended cell is unknown or unavailable."
        : "The recommended cell does not match the category's prototype mapping.",
    };
  }

  return {
    recommendedCellId: cell.id,
    recommendedCellName: cell.name,
    routingReason: `Prototype mapping to ${cell.name}; this is not an official AICTE organizational mapping.`,
    needsManualReview: false,
    manualReviewReason: null,
  };
}
