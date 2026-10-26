import { MAX_FILES, MAX_FILE_BYTES } from "@/lib/complaint-flow";
import {
  jsonError,
  loadPersistentComplaint,
  readJsonBody,
  requireApiRole,
} from "@/lib/persistence/api";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole(["student"]);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  if (!/^GRV-\d{4}-\d{4,}$/.test(id))
    return Response.json({ error: "Complaint not found." }, { status: 404 });
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return jsonError(error, "Invalid response.");
  }
  const payload =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const responseText =
    typeof payload.text === "string" ? payload.text.trim() : "";
  const evidence = payload.evidence;
  if (
    responseText.length < 10 ||
    responseText.length > 3000 ||
    !Array.isArray(evidence) ||
    evidence.length > MAX_FILES ||
    evidence.some((file) => {
      if (!file || typeof file !== "object" || Array.isArray(file)) return true;
      const item = file as Record<string, unknown>;
      return (
        typeof item.name !== "string" ||
        item.name.length < 1 ||
        item.name.length > 255 ||
        !["application/pdf", "image/png", "image/jpeg"].includes(String(item.type)) ||
        !Number.isInteger(item.size) ||
        Number(item.size) < 1 ||
        Number(item.size) > MAX_FILE_BYTES
      );
    })
  )
    return Response.json({ error: "Check the response and try again." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: owner, error: ownerError } = await supabase
    .from("complaints")
    .select("student_id")
    .eq("id", id)
    .maybeSingle();
  if (ownerError || !owner || owner.student_id !== auth.profile!.id)
    return Response.json({ error: "Complaint not found." }, { status: 404 });
  const response = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    text: responseText,
    evidence,
  };
  try {
    const { error } = await supabase.rpc("persist_student_response", {
      p_actor_id: auth.profile!.id,
      p_complaint_id: id,
      p_response: response,
    });
    if (error)
      return Response.json(
        { error: "We couldn't save your response. Please try again." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    const record = await loadPersistentComplaint(id, auth.profile!);
    return Response.json(
      { record },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "We couldn't save your response. Please try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
