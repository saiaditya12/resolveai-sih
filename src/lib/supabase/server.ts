import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getPublicSupabaseConfig } from "./config";

export function hasSupabaseAdminConfiguration(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function createSupabaseServerClient() {
  const { url, anonKey } = getPublicSupabaseConfig();
  // Partial prefetching can resolve cookies during session prerendering.
  // Supabase checks session expiry with Date.now(), including in its initial
  // auth subscription, so defer client creation itself to the actual request.
  await connection();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet)
            cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; proxy refreshes them.
        }
      },
    },
  });
}

export function createSupabaseAdminClient() {
  const { url } = getPublicSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey)
    throw new Error("The server-only Supabase service-role key is not configured.");
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
