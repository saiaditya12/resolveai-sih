import { canActOnComplaint, canReadComplaint, actionAudit } from "@/lib/authorization";
import {
  applyOfficerAction,
  validateOfficerAction,
  type OfficerAction,
} from "@/lib/officer-model";
import {
  databaseEventId,
  jsonError,
  loadPersistentComplaint,
  readJsonBody,
  requireApiRole,
} from "@/lib/persistence/api";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function isOfficerAction(value: unknown): value is OfficerAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  if (typeof action.type !== "string") return false;
  if (action.type === "request")
    return (
      (action.recipient === "Student" || action.recipient === "Institution") &&
      typeof action.text === "string" &&
      typeof action.dueDate === "string"
    );
  if (action.type === "status")
    return typeof action.status === "string" && typeof action.note === "string";
  if (action.type === "transfer")
    return typeof action.cellId === "string" && typeof action.reason === "string";
  if (action.type === "escalate") return typeof action.reason === "string";
  if (action.type === "resolve")
    return (
      typeof action.summary === "string" &&
      typeof action.action === "string" &&
      typeof action.reference === "string"
    );
  return false;
}

function eventType(action: OfficerAction) {
  if (action.type === "request")
    return action.recipient === "Student"
      ? "information_requested_student"
      : "information_requested_institution";
  if (action.type === "status") return "status_updated";
  if (action.type === "transfer") return "case_transferred";
  if (action.type === "escalate") return "case_escalated";
  return "case_resolved";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole(["officer", "admin"]);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  if (!/^GRV-\d{4}-\d{4,}$/.test(id))
    return Response.json({ error: "Complaint not found." }, { status: 404 });
  let body: unknown;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return jsonError(error, "Invalid officer action.");
  }
  const actionValue =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>).action
      : null;
  if (!isOfficerAction(actionValue))
    return Response.json({ error: "Choose a valid case action." }, { status: 400 });
  const supabase = createSupabaseAdminClient();
  const { data: before, error: readError } = await supabase
    .from("complaints")
    .select("updated_at")
    .eq("id", id)
    .maybeSingle();
  if (readError || !before)
    return Response.json({ error: "Complaint not found." }, { status: 404 });
  const item = await loadPersistentComplaint(id, auth.profile!);
  if (!item)
    return Response.json({ error: "Complaint not found." }, { status: 404 });
  if (!canActOnComplaint(auth.profile!, item))
    return Response.json({ error: "You cannot act on this case." }, { status: 403 });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const validation = validateOfficerAction(item, actionValue, today);
  if (validation)
    return Response.json({ error: validation }, { status: 400 });
  const at = new Date().toISOString();
  const updated = applyOfficerAction(item, actionValue, at, databaseEventId());
  const event = updated.events[updated.events.length - 1];
  try {
    const { error } = await supabase.rpc("persist_officer_action", {
      p_actor_id: auth.profile!.id,
      p_complaint_id: id,
      p_expected_updated_at: before.updated_at,
      p_patch: {
        status: updated.status,
        cell_id: updated.cellId,
        routing_status: updated.routingStatus,
        overridden_by_officer: updated.overriddenByOfficer,
        request: updated.request ?? null,
        resolution: updated.resolution ?? null,
        escalation_reason: updated.escalationReason ?? null,
        institution_response: updated.institutionResponse ?? null,
        due_at: updated.dueAt || "",
        resolved_at: updated.resolution?.at ?? "",
        updated_at: updated.updatedAt,
      },
      p_event: {
        id: event.id,
        at: event.at,
        event_type: eventType(actionValue),
        title: event.title,
        explanation: event.explanation,
        details: actionAudit(auth.profile!, item.cellId, updated.cellId, actionValue.type, "reason" in actionValue ? actionValue.reason : ""),
      },
    });
    if (error) {
      const stale = /stale|finalised/i.test(error.message);
      const forbidden = /forbidden/i.test(error.message);
      return Response.json(
        { error: forbidden ? "Your account no longer owns this case." : stale ? "This case changed. Reload it before taking another action." : "We couldn't save that action. Please try again." },
        { status: forbidden ? 403 : stale ? 409 : 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    const persisted = canReadComplaint(auth.profile!, updated) ? await loadPersistentComplaint(id, auth.profile!) : null;
    return Response.json(
      { record: persisted, removedId: persisted ? undefined : id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "We couldn't save that action. Please try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
