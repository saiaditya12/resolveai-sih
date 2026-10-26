import { attachComplaintIntelligence } from "@/lib/complaint-store";
import { analyzeComplaint } from "@/lib/intelligence/analyze";
import { validateComplaintIntelligenceResult } from "@/lib/intelligence/schema";
import { isComplaintCategory } from "@/lib/intelligence/categories";
import {
  databaseEventId,
  loadPersistentComplaint,
  requireApiRole,
} from "@/lib/persistence/api";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function eventType(title: string) {
  if (title === "Analysis completed") return "analysis_completed";
  if (title === "Fallback rules used") return "fallback_used";
  if (title === "Manual review required") return "manual_review_required";
  return "complaint_routed";
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole(["student"]);
  if (auth.error) return auth.error;
  const { id } = await context.params;
  if (!/^GRV-\d{4}-\d{4,}$/.test(id))
    return Response.json({ error: "Complaint not found." }, { status: 404 });
  const supabase = createSupabaseAdminClient();
  const { data: ownership, error: ownershipError } = await supabase
    .from("complaints")
    .select("student_id,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (ownershipError || !ownership || ownership.student_id !== auth.profile!.id)
    return Response.json({ error: "Complaint not found." }, { status: 404 });
  const record = await loadPersistentComplaint(id, auth.profile!);
  if (!record)
    return Response.json({ error: "Complaint not found." }, { status: 404 });
  if (record.intelligence)
    return Response.json({ record }, { headers: { "Cache-Control": "no-store" } });
  try {
    const result = validateComplaintIntelligenceResult(
      await analyzeComplaint({
        title: record.title,
        description: record.description,
        institution: record.institution,
        ...(isComplaintCategory(record.category)
          ? { studentSelectedCategory: record.category }
          : {}),
      }),
    );
    const updated = attachComplaintIntelligence(record, result);
    const addedEvents = updated.events.slice(record.events.length).map((event) => ({
      id: databaseEventId(),
      at: event.at,
      actor: event.actor,
      event_type: eventType(event.title),
      title: event.title,
      explanation: event.explanation,
    }));
    const { error } = await supabase.rpc("persist_complaint_analysis", {
      p_actor_id: auth.profile!.id,
      p_complaint_id: id,
      p_expected_updated_at: ownership.updated_at,
      p_patch: {
        category: updated.category,
        priority: updated.priority,
        status: updated.status,
        cell_id: updated.cellId,
        routing_status: updated.routingStatus,
        recommended_cell_id: updated.recommendedCellId,
        routed_at: updated.routedAt ?? "",
        overridden_by_officer: updated.overriddenByOfficer,
        summary: updated.summary,
        updated_at: updated.updatedAt,
      },
      p_result: result,
      p_events: addedEvents,
    });
    if (error) throw new Error("Analysis persistence failed.");
    const persisted = await loadPersistentComplaint(id, auth.profile!);
    if (!persisted) throw new Error("Persisted complaint could not be reloaded.");
    return Response.json(
      { record: persisted },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Your complaint was saved, but analysis is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
