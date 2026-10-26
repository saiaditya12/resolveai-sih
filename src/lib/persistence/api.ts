import "server-only";
import { canReadComplaint, type AppProfile } from "../authorization";
import { getReviewCell } from "../cells";

import { randomInt, randomUUID } from "node:crypto";
import { authenticateApiRequest } from "@/lib/supabase/auth";
import {
  createSupabaseAdminClient,
  hasSupabaseAdminConfiguration,
} from "@/lib/supabase/server";
import { mapPersistentComplaint } from "./mapper";
import type { SharedComplaintRecord } from "@/lib/complaint-store";

const MAX_API_BYTES = 64 * 1024;

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json")
    throw new TypeError("Expected JSON.");
  const contentLength = request.headers.get("content-length");
  if (
    contentLength &&
    (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_API_BYTES)
  )
    throw new RangeError("Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new TypeError("Missing request body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_API_BYTES) {
      await reader.cancel();
      throw new RangeError("Request is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export async function requireApiRole(roles: readonly string[]) {
  if (!hasSupabaseAdminConfiguration()) {
    return {
      profile: null,
      error: Response.json(
        { error: "Persistent account storage is not configured on the server." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
  const auth = await authenticateApiRequest();
  if (!auth.profile) {
    return {
      profile: null,
      error: Response.json(
        { error: auth.error },
        {
          status: auth.status,
          headers: { "Cache-Control": "no-store" },
        },
      ),
    };
  }
  if (!roles.includes(auth.profile.role)) {
    return {
      profile: null,
      error: Response.json(
        { error: "You do not have permission to perform this action." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }
  return { profile: auth.profile, error: null };
}

export async function loadPersistentComplaint(
  id: string,
  profile: AppProfile,
): Promise<SharedComplaintRecord | null> {
  const supabase = createSupabaseAdminClient();
  const { data: row, error } = await supabase
    .from("complaints")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load complaint.");
  if (!row || !canReadComplaint(profile, {studentId: row.student_id, cellId: row.cell_id})) return null;
  const [studentProfile, intelligence, events, evidence, responses] =
    await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", row.student_id).maybeSingle(),
      supabase.from("complaint_intelligence").select("*").eq("complaint_id", id).maybeSingle(),
      supabase.from("complaint_events").select("*").eq("complaint_id", id).order("at"),
      supabase.from("complaint_evidence").select("*").eq("complaint_id", id).order("created_at"),
      supabase.from("complaint_responses").select("*").eq("complaint_id", id).order("created_at"),
    ]);
  if (studentProfile.error || intelligence.error || events.error || evidence.error || responses.error)
    throw new Error("Could not load complaint details.");
  return mapPersistentComplaint(row, {
    profile: studentProfile.data ?? undefined,
    intelligence: intelligence.data ?? undefined,
    events: events.data ?? [],
    evidence: evidence.data ?? [],
    responses: responses.data ?? [],
  });
}

export async function loadPersistentComplaints(
  profile: AppProfile,
) {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("complaints").select("*");
  if (profile.role === "student") query = query.eq("student_id", profile.id);
  else if (profile.role === "officer") {
    if (!getReviewCell(profile.cell_id)) return [];
    query = query.eq("cell_id", profile.cell_id);
  } else if (profile.role !== "admin") return [];
  const { data: complaintRows, error } = await query.order("submitted_at", {
    ascending: false,
  });
  if (error) throw new Error("Could not load complaints.");
  const rows = complaintRows ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const studentIds = [...new Set(rows.map((row) => row.student_id))];
  const [profiles, intelligence, events, evidence, responses] = await Promise.all([
    supabase.from("profiles").select("id,display_name").in("id", studentIds),
    supabase.from("complaint_intelligence").select("*").in("complaint_id", ids),
    supabase.from("complaint_events").select("*").in("complaint_id", ids).order("at"),
    supabase.from("complaint_evidence").select("*").in("complaint_id", ids).order("created_at"),
    supabase.from("complaint_responses").select("*").in("complaint_id", ids).order("created_at"),
  ]);
  if (profiles.error || intelligence.error || events.error || evidence.error || responses.error)
    throw new Error("Could not load complaint history.");
  const profileById = new Map(profiles.data.map((item) => [item.id, item]));
  const intelligenceById = new Map(intelligence.data.map((item) => [item.complaint_id, item]));
  const groupByComplaint = <T extends { complaint_id: string }>(items: T[]) => {
    const groups = new Map<string, T[]>();
    for (const item of items) groups.set(item.complaint_id, [...(groups.get(item.complaint_id) ?? []), item]);
    return groups;
  };
  const eventsById = groupByComplaint(events.data);
  const evidenceById = groupByComplaint(evidence.data);
  const responsesById = groupByComplaint(responses.data);
  return rows.map((row) =>
    mapPersistentComplaint(row, {
      profile: profileById.get(row.student_id),
      intelligence: intelligenceById.get(row.id),
      events: eventsById.get(row.id),
      evidence: evidenceById.get(row.id),
      responses: responsesById.get(row.id),
    }),
  );
}

export function makeComplaintId(): string {
  const year = new Intl.DateTimeFormat("en", {
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  return `GRV-${year}-${randomInt(1000, 10000)}`;
}

export function databaseEventId(): string {
  return randomUUID();
}

export function jsonError(error: unknown, generic: string) {
  if (error instanceof RangeError)
    return Response.json({ error: "Request is too large." }, { status: 413 });
  if (error instanceof TypeError)
    return Response.json({ error: "Invalid request format." }, { status: 400 });
  return Response.json({ error: generic }, { status: 400 });
}
