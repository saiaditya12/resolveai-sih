# Complaint submission prerender clock audit — 2026-10-25

## Reproduced cause and fix

Signed-out requests redirected normally and both diagnostic and normal builds passed. Signing in reproduced `Date.now()` errors on `/student/complaints/new` and `/student/dashboard`.

Call path: `StudentLayout` → `requireRole` → `getAuthenticatedProfile` → `createSupabaseServerClient` → Supabase `createServerClient` / `auth.getUser()` → `SupabaseAuthClient.__loadSession()` (`@supabase/auth-js/dist/main/GoTrueClient.js:2541`, ESM equivalent line 2538).

The installed SDK reads `Date.now()` to check session expiration. A synthetic session with a fully stubbed transport reproduced two paths: `_emitInitialSession` → `_useSession` → `__loadSession`, and `getUser` → `_getUser` → `_useSession` → `__loadSession`. No real credentials or network requests were used in that regression test. With no stored session the clock branch is not reached.

Next 16.4.3 partial prefetching resolves cookies in the session shell. Its `node-environment-extensions/io-utils.js` also tracks synchronous time access in runtime prefetch stages, so `await cookies()` alone does not protect SDK session-expiry checks. The earlier fix made form date validation explicit but did not cover this indirect SDK read. A production build without a signed-in session cannot exercise this branch.

`src/lib/supabase/server.ts:createSupabaseServerClient` now awaits `connection()` **before** cookies and SDK construction. Construction must be behind the boundary too because the SDK registers an initial-session callback. Session expiry, `getUser()`, role checks, refresh, cookie handling, persistence and Groq remain unchanged. Cache Components and partial prefetching remain enabled.

## Dependency audit and classification

Traversed runtime imports from root layout, student layout and new complaint page (38 local modules), excluding type-only imports. Also searched all source files, tests, API/bootstrap, patterns, persistence and Supabase helpers. Inspected third-party auth session clock callers. No application module-level current-time or random initialization remains in this route graph. Fixed fixture calculations at module evaluation remain intentional.

| Location / callers | Classification | Disposition |
| --- | --- | --- |
| Supabase `__loadSession`, reached through server auth factory and initial subscription | 1: unsafe during session prerender; now 3: after `connection()` | Fixed at factory boundary, not in dependency code |
| SDK expiry/refresh helpers, reached by server auth | 3: request-only after factory boundary | Keep actual wall-clock expiry checks |
| `ComplaintFlow.go`, `advance`: `new Date`, `todayInIndia` | 2: event handlers | Unchanged |
| `ComplaintStoreProvider.createComplaint`, `applyOfficerAction`: date, `getRandomValues`, `randomUUID` | 2: action callbacks | Unchanged |
| `EvidenceUploader`: `randomUUID` in file input handler | 2 | Unchanged |
| `intelligence/client.requestComplaintIntelligence`: fallback timestamp | 2: asynchronous submission action | Unchanged |
| `supabase/browser.createSupabaseBrowserClient` and SDK clocks | 2: provider effect or sign-in/sign-out handlers | Lazy singleton declaration has no initialization side effect |
| `ComplaintStoreProvider`, `StudentDemoProvider`, `ComplaintFlow` state initializers | Deterministic empty/static values | No clock access |
| `ComplaintFlow` draft restoration | 2: effect reading tab session storage | No clock access |
| `SimilarityNotice` memo calculations | 4: explicit draft timestamp / record timestamps | No current-time fallback |
| `complaint-flow.todayInIndia`, `validPastDate`, `validateDetails` | 4: explicit arguments | No current-time default; date formatting receives a Date |
| `complaint-store`: event ordering, analysis event IDs, updated time comparisons | 4: parsed record / analysis timestamps | No current-time fallback |
| `complaint-tracking`: SLA calculation and `formatEventTime`; `demo-student.formatDemoDate` | 4: fixed demo clock or explicit timestamp | Fixture evaluation deterministic |
| `officer-model`: metrics, queue sorting, institution history, due-date validation, action time formatting | 4: fixed demo clock or explicit action timestamp | Unchanged |
| `officer-demo` module-level seed mapping | 4: static complaint/tracking records | No live clock |
| `similarity`: comparison, window filtering, duplicate policy, `corpusClock`, repeated patterns | 4: input timestamps; empty corpus uses epoch 0 | Default `asOf = corpusClock(records)` is deterministic |
| `sla/*`: date parsing, deadlines, analytics | 4: explicit inputs / fixed policy | No live clock |
| `patterns/*`: trend/window parsing and corpus clock | 4; not imported by this route at runtime | No live clock |
| `persistence/mapper` | 4: database timestamps; API-only | No live clock |
| `persistence/api`: complaint ID year, `randomInt`, event `randomUUID` | 3: API actions, not prerender | Unchanged |
| Complaint POST, response POST, officer action POST, intelligence POST | 3: request handlers; not page imports | Live timestamps/IDs are correct here |
| `intelligence/analyze`: `Date.now`, default analysis date, request UUID | 3: API invocation, not page imports | Groq logic unchanged |
| `supabase/proxy.refreshSupabaseSession` | 3: explicit incoming request, outside React prerender | No extra `connection()` needed |
| Officer action panels/providers and student response panel | 2: handlers, outside new complaint graph | Unchanged |
| Tests | 5: fixed fixture times and isolated clock probes | Not in application graph |

No application `Math.random()` hit. `Date.parse()` uses explicit input timestamps, not current-time defaults. No render-time `Intl.DateTimeFormat.format()` call omits its timestamp.

## Verification

- 116 tests pass, including two new Supabase regressions: blocked connection prevents both cookie reads and client construction; installed SDK clock access reproduces only with a synthetic signed-in session.
- Lint, standalone typecheck and normal production build pass.
- Signed-in development browser: direct navigation, refresh, dashboard → form navigation work without new Date.now errors or hydration mismatches. Institution, title and description restore from an unsubmitted local draft after reload; restoration message also appears after leaving/returning.
- Signed-out direct navigation redirected to `/login?error=session`; auth logic was not bypassed.
- Production server on localhost:3001: signed-in direct render and refresh display the complaint form with an empty warning/error console. A cookie-free HTTP probe receives the login redirect instruction and no complaint form. The temporary draft was never submitted.
- A separate existing development-only `instant-unrendered-segment` diagnostic is emitted because the workspace bootstrap provider omits children while loading. This is not a time-access or hydration error; it has not been suppressed or folded into this narrowly scoped fix.

## Student instant-navigation insight diagnosis — 2026-10-25

Next.js 16.4.3's development insight says it could not validate a segment and dropped it from rendering. The root `ComplaintStoreProvider` initializes `loading` to `true` in persistent mode and intentionally renders only its loading status instead of `{children}` until the browser bootstrap request finishes. During development validation, that parent prevents the student layout segment from being rendered for inspection. This matches the development-only `instant-unrendered-segment` observation above and is distinct from the fixed `Date.now()` prerender error.

The student layout also performs real request-time authorization: `requireRole(["student"])` reads Supabase cookies after `connection()`, validates the user with `auth.getUser()`, then checks the stored profile role. That check is inherently request-dependent; Next's Cache Components authentication guidance says it cannot be part of the static shell. It can be placed behind Suspense without rendering protected children before authorization, but doing so did not remove this insight because the root provider still withholds the segment. Changing the global bootstrap/loading behavior could expose an empty or stale workspace before account data loads. Therefore no product code or `instant = false` opt-out is warranted for this development-only diagnostic; auth and loading protections remain unchanged.

The production build and 116-test suite passed before this follow-up; an unauthenticated browser request still redirected to `/login?error=session`. The configured local environment uses Supabase authentication, and no authenticated browser session was available for repeating signed-in route and draft checks. Prior signed-in checks remain recorded in the verification section above.
