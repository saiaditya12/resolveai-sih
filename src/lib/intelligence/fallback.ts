import {
  officerCells,
  type ComplaintPriority,
} from "../officer-model.ts";
import {
  isComplaintCategory,
  type ComplaintCategory,
} from "./categories.ts";
import { resolveRouting } from "./routing-config.ts";
import { validateComplaintIntelligenceResult } from "./schema.ts";
import type { ComplaintIntelligenceResult } from "./types.ts";

interface ComplaintText {
  title: string;
  description: string;
  analyzedAt: string;
}

interface CategoryRule {
  category: ComplaintCategory;
  keywords: ReadonlyArray<readonly [string, number]>;
}

interface ConfidenceEvaluation {
  needsManualReview: boolean;
  reviewRecommended: boolean;
  manualReviewReason: string | null;
}

interface PriorityEvaluation {
  priority: ComplaintPriority;
  urgencyReason: string;
}

const categoryRules: readonly CategoryRule[] = [
  {
    category: "Fees / Refund",
    keywords: [
      ["refund", 3],
      ["refunded", 3],
      ["fee", 2],
      ["fees", 2],
      ["payment", 2],
      ["deposit", 2],
    ],
  },
  {
    category: "Student Records",
    keywords: [
      ["transcript", 3],
      ["marksheet", 3],
      ["certificate", 2],
      ["student record", 3],
      ["records", 2],
    ],
  },
  {
    category: "Scholarship / Financial Support",
    keywords: [
      ["scholarship", 3],
      ["stipend", 3],
      ["financial aid", 3],
    ],
  },
  {
    category: "Academic Issue",
    keywords: [
      ["exam", 2],
      ["course", 2],
      ["grade", 2],
      ["academic", 2],
      ["attendance", 2],
    ],
  },
  {
    category: "Faculty / Staff Conduct",
    keywords: [
      ["faculty", 3],
      ["professor", 3],
      ["lecturer", 3],
      ["staff conduct", 3],
      ["harassment", 3],
    ],
  },
  {
    category: "Infrastructure / Facilities",
    keywords: [
      ["hostel", 2],
      ["classroom", 3],
      ["lab", 2],
      ["infrastructure", 3],
      ["facility", 2],
      ["facilities", 2],
    ],
  },
  {
    category: "Approval / Recognition",
    keywords: [
      ["approval", 2],
      ["approved", 2],
      ["recognition", 3],
      ["recognised", 3],
      ["accreditation", 3],
    ],
  },
];

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

function scoreCategories(text: string) {
  const financialSupportContext =
    /\b(scholarship|stipend|financial aid)\b/.test(text);
  const explicitFeeContext = /\b(refund|refunded|fee|fees|deposit)\b/.test(
    text,
  );

  return categoryRules
    .map(({ category, keywords }) => ({
      category,
      score: keywords.reduce(
        (score, [keyword, weight]) => {
          if (
            category === "Fees / Refund" &&
            keyword === "payment" &&
            financialSupportContext &&
            !explicitFeeContext
          )
            return score;
          return text.includes(` ${normalize(keyword).trim()} `)
            ? score + weight
            : score;
        },
        0,
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function confidenceForScores(
  topScore: number,
  secondScore: number,
): number {
  if (topScore === 0) return 0.35;
  if (secondScore > 0 && topScore - secondScore <= 1) return 0.59;

  const margin = topScore - secondScore;
  return Math.min(
    0.97,
    Number((0.62 + Math.min(topScore, 5) * 0.055 + margin * 0.035).toFixed(2)),
  );
}

export function evaluateConfidence(
  confidence: number,
  category: string,
  cellId: string | null,
): ConfidenceEvaluation {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
    throw new RangeError("Confidence must be a number from 0 through 1.");

  let manualReviewReason: string | null = null;
  if (!isComplaintCategory(category))
    manualReviewReason = "The complaint category is unknown.";
  else if (category === "Other")
    manualReviewReason = "Other complaints always require manual review.";
  else if (!cellId || !officerCells.some((cell) => cell.id === cellId))
    manualReviewReason = "No allowed demo cell is available for this complaint.";
  else if (confidence < 0.6)
    manualReviewReason =
      "Confidence is below 0.60, so an officer must select the category and route.";

  return {
    needsManualReview: manualReviewReason !== null,
    reviewRecommended: confidence >= 0.6 && confidence < 0.8,
    manualReviewReason,
  };
}

export function determinePriority(
  title: string,
  description: string,
): PriorityEvaluation {
  const text = normalize(`${title} ${description}`);

  if (/\b(fire|immediate safety risk)\b/.test(text)) {
    return {
      priority: "Critical",
      urgencyReason:
        "The complaint mentions fire or an immediate safety risk; elevated for prompt review without making a legal or medical determination.",
    };
  }
  if (
    /\b(exposed wire|exposed wiring|electrical sparks|sparks|dangerous)\b/.test(
      text,
    )
  ) {
    return {
      priority: "High",
      urgencyReason:
        "The complaint mentions a potential physical safety concern; elevated for prompt review without making a legal or medical determination.",
    };
  }
  if (
    /\b(?:30|45|60|90)\s+days\b|\bmonths\b|\blong delay\b|\brepeated (?:requests|attempts|contacts)\b|\bno response\b|\bnobody responds\b|\bno reply\b|\bsignificant financial\b|\bsubstantial amount\b|\blarge amount\b|\bentire fee\b|\blarge sum\b/.test(
      text,
    )
  ) {
    return {
      priority: "High",
      urgencyReason:
        "The complaint describes a prolonged delay, repeated unsuccessful contact, or significant financial impact.",
    };
  }

  return {
    priority: "Medium",
    urgencyReason:
      "No explicit urgent safety, prolonged-delay, repeated-contact, or significant-financial-impact rule matched; standard administrative priority applied.",
  };
}

function createSummary(title: string, description: string): string {
  const source = title.trim() || description.trim().split(/[.!?](?:\s|$)/, 1)[0];
  const summary = source.replace(/\s+/g, " ").trim();
  if (summary.length <= 160) return summary || "Complaint details provided.";
  return `${summary.slice(0, 157).trimEnd()}...`;
}

export function classifyComplaintFallback(
  complaint: ComplaintText,
): ComplaintIntelligenceResult {
  const text = normalize(`${complaint.title} ${complaint.description}`);
  const scores = scoreCategories(text);
  const category = scores[0]?.category ?? "Other";
  const confidence = confidenceForScores(
    scores[0]?.score ?? 0,
    scores[1]?.score ?? 0,
  );
  const configuredRouting = resolveRouting(category);
  const confidenceEvaluation = evaluateConfidence(
    confidence,
    category,
    configuredRouting.recommendedCellId,
  );
  const needsManualReview =
    configuredRouting.needsManualReview ||
    confidenceEvaluation.needsManualReview;
  const priority = determinePriority(complaint.title, complaint.description);

  const routingReason = needsManualReview
    ? configuredRouting.needsManualReview
      ? configuredRouting.routingReason
      : `Confidence is below the auto-routing threshold; ${configuredRouting.routingReason}`
    : confidenceEvaluation.reviewRecommended
      ? `${configuredRouting.routingReason} Confidence is 0.60–0.79; officer review is recommended.`
      : configuredRouting.routingReason;

  return validateComplaintIntelligenceResult({
    summary: createSummary(complaint.title, complaint.description),
    category,
    subcategory: "",
    priority: priority.priority,
    urgencyReason: priority.urgencyReason,
    recommendedCellId: needsManualReview
      ? null
      : configuredRouting.recommendedCellId,
    recommendedCellName: needsManualReview
      ? null
      : configuredRouting.recommendedCellName,
    routingReason,
    confidence,
    reviewRecommended: confidenceEvaluation.reviewRecommended,
    needsManualReview,
    manualReviewReason: needsManualReview
      ? (confidenceEvaluation.manualReviewReason ??
        configuredRouting.manualReviewReason)
      : null,
    source: needsManualReview ? "Manual Review" : "Fallback Rules",
    analyzedAt: complaint.analyzedAt,
  });
}
