import {
  isComplaintCategory,
  type ComplaintCategory,
} from "./categories.ts";

export interface EvidenceMetadataInput {
  name: string;
  type: string;
  size: number;
}

export interface ComplaintAnalysisInput {
  title: string;
  description: string;
  institution?: string;
  studentSelectedCategory?: ComplaintCategory;
  evidenceMetadata?: EvidenceMetadataInput[];
}

const allowedFields = new Set([
  "title",
  "description",
  "institution",
  "studentSelectedCategory",
  "evidenceMetadata",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(
  value: unknown,
  field: string,
  minLength: number,
  maxLength: number,
): string {
  if (
    typeof value !== "string" ||
    value.trim().length < minLength ||
    value.length > maxLength
  )
    throw new TypeError(
      `${field} must contain ${minLength}–${maxLength} characters.`,
    );
  return value.trim();
}

export function validateComplaintAnalysisInput(
  value: unknown,
): ComplaintAnalysisInput {
  if (!isRecord(value))
    throw new TypeError("Request body must be a JSON object.");

  const unexpectedField = Object.keys(value).find(
    (field) => !allowedFields.has(field),
  );
  if (unexpectedField)
    throw new TypeError(`Unexpected request field: ${unexpectedField}.`);

  const title = requiredText(value.title, "title", 5, 120);
  const description = requiredText(value.description, "description", 50, 3000);

  let institution: string | undefined;
  if (value.institution !== undefined) {
    if (typeof value.institution !== "string" || value.institution.length > 200)
      throw new TypeError("institution must be a string of at most 200 characters.");
    institution = value.institution.trim() || undefined;
  }

  let studentSelectedCategory: ComplaintCategory | undefined;
  if (value.studentSelectedCategory !== undefined) {
    if (
      value.studentSelectedCategory !== "" &&
      !isComplaintCategory(value.studentSelectedCategory)
    )
      throw new TypeError("studentSelectedCategory is not a supported category.");
    if (isComplaintCategory(value.studentSelectedCategory))
      studentSelectedCategory = value.studentSelectedCategory;
  }

  let evidenceMetadata: EvidenceMetadataInput[] | undefined;
  if (value.evidenceMetadata !== undefined) {
    if (
      !Array.isArray(value.evidenceMetadata) ||
      value.evidenceMetadata.length > 5
    )
      throw new TypeError("evidenceMetadata must contain at most five items.");

    evidenceMetadata = value.evidenceMetadata.map((entry, index) => {
      if (!isRecord(entry))
        throw new TypeError(`evidenceMetadata[${index}] must be an object.`);

      const keys = Object.keys(entry);
      if (
        keys.some((key) => !["name", "type", "size"].includes(key)) ||
        typeof entry.name !== "string" ||
        entry.name.length > 255 ||
        typeof entry.type !== "string" ||
        entry.type.length > 100 ||
        typeof entry.size !== "number" ||
        !Number.isFinite(entry.size) ||
        entry.size < 0 ||
        entry.size > 5 * 1024 * 1024
      )
        throw new TypeError(`evidenceMetadata[${index}] is invalid.`);

      return {
        name: entry.name,
        type: entry.type,
        size: entry.size,
      };
    });
  }

  return {
    title,
    description,
    ...(institution ? { institution } : {}),
    ...(studentSelectedCategory ? { studentSelectedCategory } : {}),
    ...(evidenceMetadata ? { evidenceMetadata } : {}),
  };
}
