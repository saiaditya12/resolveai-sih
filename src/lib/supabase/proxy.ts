import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseConfig, hasSupabaseConfiguration } from "./config";

export async function refreshSupabaseSession(request: NextRequest) {
  if (!hasSupabaseConfiguration()) return NextResponse.next({ request });
  const { url, anonKey } = getPublicSupabaseConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet)
          request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet)
          response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}
