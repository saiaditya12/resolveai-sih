import {
  institutions,
  MAX_FILES,
  MAX_FILE_BYTES,
} from "@/lib/complaint-flow";
import { isComplaintCategory } from "@/lib/intelligence/categories";
import {
  jsonError,
  loadPersistentComplaint,
  makeComplaintId,
  requireApiRole,
  readJsonBody,
} from "@/lib/persistence/api";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function validDate(value: unknown): value is string {
  if (value === "" || value === null || value === undefined) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function POST(request: Request) {
  const auth = await requireApiRole(["student"]);
  if (auth.error) return auth.error;
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return jsonError(error, "Invalid complaint submission.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return Response.json({ error: "Check the complaint details and try again." }, { status: 400 });
  const draft = body as Record<string, unknown>;
  const title = typeof draft.title === "string" ? draft.title.trim() : "";
  const description =
    typeof draft.description === "string" ? draft.description.trim() : "";
  const institution =
    typeof draft.institution === "string" ? draft.institution.trim() : "";
  const category =
    typeof draft.category === "string" ? draft.category : "";
  const contacted = draft.contacted;
  const evidence = draft.evidence;
  if (
    title.length < 5 ||
    title.length > 120 ||
    description.length < 50 ||
    description.length > 3000 ||
    !institutions.some((item) => item.name === institution) ||
    (category !== "" && !isComplaintCategory(category)) ||
    (contacted !== "yes" && contacted !== "no") ||
    !validDate(draft.incidentDate) ||
    !validDate(draft.contactDate) ||
    (contacted !== "yes" && draft.contactDate !== "") ||
    typeof draft.response !== "string" ||
    draft.response.length > 1000 ||
    !Array.isArray(evidence) ||
    evidence.length > MAX_FILES
  )
    return Response.json(
      { error: "Check the complaint details and evidence, then try again." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  const metadata = evidence.map((file) => {
    if (!file || typeof file !== "object" || Array.isArray(file))
      return null;
    const item = file as Record<string, unknown>;
    if (
      typeof item.name !== "string" ||
      item.name.length < 1 ||
      item.name.length > 255 ||
      !["application/pdf", "image/png", "image/jpeg"].includes(
        String(item.type),
      ) ||
      !Number.isInteger(item.size) ||
      Number(item.size) < 1 ||
      Number(item.size) > MAX_FILE_BYTES
    )
      return null;
    return { name: item.name, type: item.type, size: item.size };
  });
  if (metadata.some((item) => item === null))
    return Response.json(
      { error: "One or more evidence files are not supported." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  const supabase = createSupabaseAdminClient();
  const submittedAt = new Date().toISOString();
  const payload = {
    id: makeComplaintId(),
    institution,
    title,
    description,
    selected_category_hint: category,
    incident_date: draft.incidentDate ?? "",
    contacted: contacted === "yes",
    contact_date: contacted === "yes" ? draft.contactDate ?? "" : "",
    contact_response: contacted === "yes" ? draft.response : "",
    submitted_at: submittedAt,
  };
  try {
    const { data: id, error } = await supabase.rpc("create_student_complaint", {
      p_student_id: auth.profile!.id,
      p_complaint: payload,
      p_evidence: metadata,
    });
    if (error || !id) throw new Error("Submission failed.");
    const record = await loadPersistentComplaint(id, auth.profile!);
    if (!record) throw new Error("Saved complaint could not be reloaded.");
    return Response.json(
      { record },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "We couldn't save your complaint. Please try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
