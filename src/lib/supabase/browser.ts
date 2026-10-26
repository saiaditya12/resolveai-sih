"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig, hasSupabaseConfiguration } from "./config";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

export function createSupabaseBrowserClient(): SupabaseClient | null {
  if (!hasSupabaseConfiguration()) return null;
  if (!browserClient) {
    const { url, anonKey } = getPublicSupabaseConfig();
    browserClient = createBrowserClient(url, anonKey);
  }
  return browserClient;
}
