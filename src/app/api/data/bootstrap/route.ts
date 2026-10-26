import { requireApiRole, loadPersistentComplaints } from "@/lib/persistence/api";

export async function GET() {
  const auth = await requireApiRole(["student", "officer", "admin"]);
  if (auth.error) return auth.error;
  try {
    const records = await loadPersistentComplaints(auth.profile!);
    return Response.json(
      { mode: "persistent", profile: auth.profile, records },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "We couldn't load your complaints. Please refresh and try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
