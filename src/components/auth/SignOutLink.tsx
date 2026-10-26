"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SignOutLink({
  className,
  demoHref = "/login",
  children = "Sign out",
}: {
  className?: string;
  demoHref?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const persistent = hasSupabaseConfiguration();
  if (!persistent)
    return (
      <Link className={className} href={demoHref}>
        {children}
      </Link>
    );
  return (
    <>
      <button
        className={className}
        type="button"
        onClick={async () => {
          const client = createSupabaseBrowserClient();
          if (!client) return;
          const { error: signOutError } = await client.auth.signOut();
          if (signOutError) {
            setError("We couldn't sign you out. Please try again.");
            return;
          }
          router.replace("/login");
          router.refresh();
        }}
      >
        {children}
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
