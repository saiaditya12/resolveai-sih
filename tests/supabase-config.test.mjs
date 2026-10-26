import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { hasSupabaseConfiguration } from "../src/lib/supabase/config.ts";

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalAnonKey === undefined)
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
});

test("Supabase configuration is disabled when both public values are absent", () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.equal(hasSupabaseConfiguration(), false);
});

test("partial Supabase configuration fails explicitly", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.throws(
    () => hasSupabaseConfiguration(),
    /requires both the Supabase URL and public anon key/,
  );
});

test("complete public Supabase configuration enables persistent mode", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-test-key";
  assert.equal(hasSupabaseConfiguration(), true);
});
