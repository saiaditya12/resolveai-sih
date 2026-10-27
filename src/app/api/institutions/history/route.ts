import {
  loadPersistentInstitutionStats,
  requireApiRole,
} from "@/lib/persistence/api";
import { getReviewCell } from "@/lib/cells";

export async function GET(request: Request) {
  const auth = await requireApiRole(["officer", "admin"]);
  if (auth.error) return auth.error;
  if (
    auth.profile?.role === "officer" &&
    !getReviewCell(auth.profile.cell_id)
  ) {
    return Response.json(
      { error: "No review cell is assigned to this officer account." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const institution = new URL(request.url).searchParams.get("institution")?.trim();
  if (!institution || institution.length < 2 || institution.length > 160) {
    return Response.json(
      { error: "A valid institution name is required." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const stats = await loadPersistentInstitutionStats(institution);
    return Response.json(
      { stats },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Institution history is temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
