import { normalizeText } from "./similarity/normalize.ts";

// Display-only labels. Never use these to normalize stored content or authorize access.
export function cellDisplayName(value: string | null | undefined): string {
  if (!value) return "Not assigned";
  const names: Record<string, string> = {
    student: "Student Grievance Cell",
    approval: "Approval Review Cell",
    finance: "Finance/Refund Review Cell",
    records: "Student Records Cell",
    "Demo Student Grievance Cell": "Student Grievance Cell",
    "Demo Approval Review Cell": "Approval Review Cell",
    "Demo Finance/Refund Review Cell": "Finance/Refund Review Cell",
    "Demo Academic Records Cell": "Student Records Cell",
    "Demo Escalation Review Cell": "Escalation Review Cell",
  };
  return names[value] ?? value;
}

export function roleDisplayName(role: string): string {
  return ({ student: "Student", officer: "Cell Officer", admin: "Administrator" } as Record<string, string>)[role] ?? "Account";
}

export function personDisplayName(value: string | null | undefined): string {
  if (!value) return "Not provided";
  if (/^(?:Demo|Fictional) Student(?:\s+.+)?$/i.test(value.trim()))
    return "Student";
  if (/^Demo Officer(?:\s+.+)?$/i.test(value.trim())) return "Cell Officer";
  if (/^Demo Cell$/i.test(value.trim())) return "Review cell";
  if (/^Demo Institution$/i.test(value.trim())) return "Institution";
  return value;
}

export function institutionResponseDisplayText(value: string): string {
  if (/^(?:Fictional institution response|Fictional acknowledgement):/i.test(value))
    return "No verified institution response is available for this record.";
  return value;
}

// Only for system-authored guidance/labels, never complaint text, evidence or audit explanations.
export function systemDisplayText(value: string): string {
  return value
    .replace(/Demo Academic Records Cell/g, "Student Records Cell")
    .replace(/Prototype \/ demo policy/g, "Service-level target")
    .replace(/\b(?:local demo|prototype|demo|mock|sample)\s+/gi, "")
    .replace(/in this demo\b/gi, "in this workspace")
    .replace(/in this prototype\b/gi, "yet")
    .replace(/this sample\b/gi, "these records");
}

// Directory labels do not rewrite names on existing persisted complaints.
export function institutionDisplayName(name: string): string {
  return name.replace(/^Demo\s+/i, "");
}

export function normalizeInstitutionName(name: string): string {
  return normalizeText(institutionDisplayName(name));
}

// Exact legacy system boilerplate only. Persisted audit records remain unchanged.
export function auditDisplayText(value: string): string {
  return value
    .replace(/^Routed to demo cell$/, "Routed to review cell")
    .replace(/^Assigned to demo cell$/, "Assigned to review cell")
    .replace(/^Fictional complaint recorded for the officer (?:workspace )?demo\.$/i, "Complaint recorded for review.")
    .replace(/^Prewritten sample history; no (?:officer action was taken|real assignment occurred)\.$/i, "Review history recorded.")
    .replace(/^Prewritten sample workflow event, not a real request or assignment\.$/i, "Workflow update recorded.")
    .replace(/^The demo intake team checked the available context\.$/i, "The intake team checked the available context.")
    .replace(/^The demo deadline was exceeded\. A fictional escalation reviewer now owns the case\.$/i, "The deadline was exceeded. The escalation reviewer now owns the case.")
    .replace(/^The illustrative response deadline has passed\. No escalation is recorded for this sample\.$/i, "The response deadline has passed. No escalation is recorded.")
    .replace(/Demo (Student Grievance|Approval Review|Finance\/Refund Review|Escalation Review) Cell/g, "$1 Cell")
    .replace(/Demo Academic Records Cell/g, "Student Records Cell")
    .replace(/ This is a prototype mapping, not an official AICTE assignment\.$/, "")
    .replace(/ Local demo only; no message sent\.$/, " No external message sent.");
}
