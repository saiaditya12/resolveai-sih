"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ComplaintDraft } from "@/lib/complaint-flow";
import {
  attachComplaintIntelligence,
  applySharedOfficerAction,
  createSharedComplaintRecord,
  recordStudentResponse as recordDemoStudentResponse,
  type SharedComplaintRecord,
} from "@/lib/complaint-store";
import type { ComplaintIntelligenceResult } from "@/lib/intelligence/types";
import type { OfficerAction } from "@/lib/officer-model";
import type { CaseResponse } from "@/lib/complaint-tracking";
import type { Session } from "@supabase/supabase-js";
import { officerSeedCases } from "@/lib/officer-demo";
import { complaints as studentSeedCases } from "@/lib/demo-student";
import { hasSupabaseConfiguration } from "@/lib/supabase/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type StoreProfile = import("@/lib/authorization").AppProfile;
interface ComplaintStore {
  records: SharedComplaintRecord[];
  mode: "persistent" | "demo";
  profile: StoreProfile | null;
  initialLoading: boolean;
  error: string;
  refreshError: string;
  reload: () => Promise<void>;
  createComplaint: (draft: ComplaintDraft) => Promise<SharedComplaintRecord>;
  attachIntelligence: (
    id: string,
    result?: ComplaintIntelligenceResult,
  ) => Promise<SharedComplaintRecord>;
  applyOfficerAction: (
    id: string,
    action: OfficerAction,
  ) => Promise<SharedComplaintRecord | undefined>;
  recordStudentResponse: (
    id: string,
    response: CaseResponse,
  ) => Promise<SharedComplaintRecord | undefined>;
}

const Context = createContext<ComplaintStore | null>(null);

async function requestRecord(
  url: string,
  init?: RequestInit,
): Promise<SharedComplaintRecord> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : "The request could not be completed.";
    throw new Error(message);
  }
  if (!payload || typeof payload !== "object" || !("record" in payload))
    throw new Error("The server returned an invalid complaint record.");
  return (payload as { record: SharedComplaintRecord }).record;
}

function replaceRecord(
  records: SharedComplaintRecord[],
  record: SharedComplaintRecord,
) {
  const index = records.findIndex((item) => item.id === record.id);
  if (index < 0) return [record, ...records];
  return records.map((item) => (item.id === record.id ? record : item));
}

function isProtectedWorkspacePath(pathname: string) {
  return /^\/(student|officer|admin)(\/|$)/.test(pathname);
}

export function ComplaintStoreProvider({
  children,
}: {
  children: ReactNode;
}) {
  const persistent = hasSupabaseConfiguration();
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  const [records, setRecords] = useState<SharedComplaintRecord[]>([]);
  const [profile, setProfile] = useState<StoreProfile | null>(null);
  const [initialLoading, setInitialLoading] = useState(persistent);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  const recordsRef = useRef(records);
  const activeUserId = useRef<string | null>(null);
  const requestVersion = useRef(0);
  const hasBootstrapped = useRef(!persistent);
  const usedIds = useRef(
    new Set([
      ...studentSeedCases.map((complaint) => complaint.id),
      ...officerSeedCases.map((complaint) => complaint.id),
    ]),
  );
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  const fetchPersistentData = useCallback(async (userId: string) => {
    const version = ++requestVersion.current;
    const isInitialLoad = !hasBootstrapped.current;
    if (isInitialLoad) {
      setInitialLoading(true);
      setError("");
    }
    try {
      const response = await fetch("/api/data/bootstrap", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (response.status === 401) {
        if (
          version !== requestVersion.current ||
          activeUserId.current !== userId
        )
          return;
        activeUserId.current = null;
        hasBootstrapped.current = true;
        recordsRef.current = [];
        setRecords([]);
        setProfile(null);
        setInitialLoading(false);
        setError("");
        setRefreshError("");
        if (isProtectedWorkspacePath(pathnameRef.current))
          router.replace("/login?error=session");
        return;
      }
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          payload?.error || "We couldn't load your account data.",
        );
      if (
        !payload ||
        typeof payload !== "object" ||
        !Array.isArray(payload.records) ||
        !payload.profile ||
        typeof payload.profile.id !== "string" ||
        payload.profile.id !== userId ||
        !["student", "officer", "admin"].includes(payload.profile.role)
      )
        throw new Error("The account data did not match the active session.");
      if (
        version !== requestVersion.current ||
        activeUserId.current !== userId
      )
        return;
      recordsRef.current = payload.records;
      setRecords(payload.records);
      setProfile(payload.profile);
      hasBootstrapped.current = true;
      setError("");
      setRefreshError("");
    } catch {
      if (
        version === requestVersion.current &&
        activeUserId.current === userId
      ) {
        if (!hasBootstrapped.current)
          setError("We couldn't load your saved complaints. Try reloading.");
        else
          setRefreshError(
            "We couldn't sync your saved workspace. Your current data is still available.",
          );
      }
    } finally {
      if (
        version === requestVersion.current &&
        activeUserId.current === userId &&
        isInitialLoad
      )
        setInitialLoading(false);
    }
  }, [router]);
  const setCurrentRecords = useCallback(
    (next: SharedComplaintRecord[]) => {
      recordsRef.current = next;
      setRecords(next);
    },
    [],
  );

  useEffect(() => {
    if (!persistent) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      window.setTimeout(() => {
        hasBootstrapped.current = true;
        setInitialLoading(false);
        setError("Persistent account access is not configured.");
      }, 0);
      return;
    }
    const applySession = (session: Session | null) => {
      if (!session) {
        const wasAuthenticated = activeUserId.current !== null;
        requestVersion.current++;
        activeUserId.current = null;
        hasBootstrapped.current = true;
        recordsRef.current = [];
        setRecords([]);
        setProfile(null);
        setInitialLoading(false);
        setError("");
        setRefreshError("");
        if (wasAuthenticated && isProtectedWorkspacePath(pathnameRef.current))
          router.replace("/login?error=session");
        return;
      }

      const userId = session.user.id;
      if (activeUserId.current !== userId) {
        requestVersion.current++;
        activeUserId.current = userId;
        recordsRef.current = [];
        setRecords([]);
        setProfile(null);
        setError("");
        setRefreshError("");
      }

      void fetchPersistentData(userId);
    };
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => applySession(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [persistent, fetchPersistentData, router]);

  const reload = useCallback(async () => {
    if (!persistent) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setInitialLoading(false);
      setError("Persistent account access is not configured.");
      return;
    }
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const session = data.session;
      if (!session) {
        requestVersion.current++;
        activeUserId.current = null;
        hasBootstrapped.current = true;
        recordsRef.current = [];
        setRecords([]);
        setProfile(null);
        setInitialLoading(false);
        setError("");
        setRefreshError("");
        return;
      }
      if (activeUserId.current !== session.user.id) {
        requestVersion.current++;
        activeUserId.current = session.user.id;
        recordsRef.current = [];
        setRecords([]);
        setProfile(null);
        setError("");
        setRefreshError("");
      }
      await fetchPersistentData(session.user.id);
    } catch {
      setInitialLoading(false);
      setError("We couldn't verify your session. Please try again.");
    }
  }, [persistent, fetchPersistentData]);

  const createComplaint = useCallback(
    async (draft: ComplaintDraft) => {
      if (persistent) {
        const createdRecord = await requestRecord("/api/complaints", {
          method: "POST",
          body: JSON.stringify({
            institution: draft.institution?.name,
            title: draft.title,
            description: draft.description,
            category: draft.category,
            incidentDate: draft.incidentDate,
            contacted: draft.contacted,
            contactDate: draft.contactDate,
            response: draft.response,
            evidence: draft.evidence.map(({ name, type, size }) => ({
              name,
              type,
              size,
            })),
          }),
        });
        setCurrentRecords(replaceRecord(recordsRef.current, createdRecord));
        return createdRecord;
      }
      const year = new Intl.DateTimeFormat("en", {
        year: "numeric",
        timeZone: "Asia/Kolkata",
      }).format(new Date());
      let suffix = (crypto.getRandomValues(new Uint32Array(1))[0] % 9000) + 1000;
      while (usedIds.current.has(`GRV-${year}-${suffix}`)) suffix++;
      const id = `GRV-${year}-${suffix}`;
      usedIds.current.add(id);
      const record = createSharedComplaintRecord(
        draft,
        id,
        new Date().toISOString(),
      );
      setCurrentRecords([record, ...recordsRef.current]);
      return record;
    },
    [persistent, setCurrentRecords],
  );

  const attachIntelligence = useCallback(
    async (id: string, intelligence?: ComplaintIntelligenceResult) => {
      if (persistent) {
        const record = await requestRecord(`/api/complaints/${encodeURIComponent(id)}/analysis`, {
          method: "POST",
          body: "{}",
        });
        setCurrentRecords(replaceRecord(recordsRef.current, record));
        return record;
      }
      if (!intelligence) throw new Error("Analysis result is required in demo mode.");
      const existing = recordsRef.current.find((record) => record.id === id);
      if (!existing) throw new Error("Complaint was not found in demo memory.");
      const record = attachComplaintIntelligence(existing, intelligence);
      setCurrentRecords(replaceRecord(recordsRef.current, record));
      return record;
    },
    [persistent, setCurrentRecords],
  );

  const applyOfficerAction = useCallback(
    async (id: string, action: OfficerAction) => {
      if (persistent) {
        const response = await fetch(`/api/complaints/${encodeURIComponent(id)}/actions`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }), cache: "no-store",
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Action could not be saved.");
        if (payload.removedId === id) {
          setCurrentRecords(recordsRef.current.filter((record) => record.id !== id));
          return undefined;
        }
        const record = payload.record as SharedComplaintRecord;
        if (!record) throw new Error("Saved case is unavailable. Reload your workspace.");
        setCurrentRecords(replaceRecord(recordsRef.current, record));
        return record;
      }
      const existing = recordsRef.current.find((record) => record.id === id);
      if (!existing) return undefined;
      const record = applySharedOfficerAction(
        existing,
        action,
        new Date().toISOString(),
        crypto.randomUUID(),
      );
      setCurrentRecords(replaceRecord(recordsRef.current, record));
      return record;
    },
    [persistent, setCurrentRecords],
  );

  const recordStudentResponse = useCallback(
    async (id: string, response: CaseResponse) => {
      if (persistent) {
        const record = await requestRecord(
          `/api/complaints/${encodeURIComponent(id)}/responses`,
          {
            method: "POST",
            body: JSON.stringify({
              text: response.text,
              evidence: response.evidence,
            }),
          },
        );
        setCurrentRecords(replaceRecord(recordsRef.current, record));
        return record;
      }
      const existing = recordsRef.current.find((record) => record.id === id);
      if (!existing) return undefined;
      const record = recordDemoStudentResponse(existing, response);
      setCurrentRecords(replaceRecord(recordsRef.current, record));
      return record;
    },
    [persistent, setCurrentRecords],
  );

  const value = useMemo(
    () => ({
      records,
      mode: persistent ? ("persistent" as const) : ("demo" as const),
      profile,
      initialLoading,
      error,
      refreshError,
      reload,
      createComplaint,
      attachIntelligence,
      applyOfficerAction,
      recordStudentResponse,
    }),
    [
      records,
      persistent,
      profile,
      initialLoading,
      error,
      refreshError,
      reload,
      createComplaint,
      attachIntelligence,
      applyOfficerAction,
      recordStudentResponse,
    ],
  );

  return (
    <Context.Provider value={value}>
      {persistent && initialLoading ? (
        <p className="persistent-loading" role="status" aria-live="polite">
          Loading your saved workspace…
        </p>
      ) : persistent && error ? (
        <div className="persistent-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      ) : (
        <>
          {children}
          {persistent && refreshError && (
            <p className="persistent-loading" role="status" aria-live="polite">
              {refreshError}
            </p>
          )}
        </>
      )}
    </Context.Provider>
  );
}

export function useComplaintStore() {
  const value = useContext(Context);
  if (!value) throw new Error("ComplaintStoreProvider is required");
  return value;
}
