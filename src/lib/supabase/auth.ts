import "server-only";

import { redirect } from "next/navigation";
import { hasSupabaseConfiguration } from "./config";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "./server";

import { canEnterWorkspace, workspaceHome, type AppProfile, type AppRole } from "../authorization";
export type { AppProfile, AppRole } from "../authorization";

export async function getAuthenticatedProfile(): Promise<AppProfile | null> {
  if (!hasSupabaseConfiguration()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return null;
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,display_name,role,cell_id")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !profile) return null;
  if (!["student", "officer", "admin"].includes(profile.role)) return null;
  return profile as AppProfile;
}

export async function requireRole(
  roles: readonly AppRole[],
): Promise<AppProfile | null> {
  if (!hasSupabaseConfiguration()) return null;
  const profile = await getAuthenticatedProfile();
  if (!profile) redirect("/login?error=session");
  if (!roles.some(role => canEnterWorkspace(profile, role))) {
    redirect(workspaceHome(profile.role));
  }
  return profile;
}

export async function authenticateApiRequest() {
  if (!hasSupabaseConfiguration())
    return {
      profile: null,
      error: "Persistent mode is not configured.",
      status: 503,
    } as const;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    const invalidSession =
      !userError ||
      [400, 401, 403].includes(userError.status ?? 0) ||
      userError.code === "bad_jwt" ||
      userError.code === "session_not_found" ||
      userError.code === "user_not_found";
    return {
      profile: null,
      error: invalidSession
        ? "Sign in to continue."
        : "Authentication is temporarily unavailable.",
      status: invalidSession ? 401 : 503,
    } as const;
  }
  const admin = createSupabaseAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id,display_name,role,cell_id")
    .eq("id", user.id)
    .maybeSingle();
  if (error)
    return {
      profile: null,
      error: "Your account profile is temporarily unavailable.",
      status: 503,
    } as const;
  if (!profile || !["student", "officer", "admin"].includes(profile.role))
    return {
      profile: null,
      error: "Your account profile is unavailable.",
      status: 403,
    } as const;
  return { profile: profile as AppProfile, error: null } as const;
}
