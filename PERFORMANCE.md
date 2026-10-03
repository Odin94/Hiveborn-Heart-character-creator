# Performance deep dive — 2026-10-03

Baseline: `8a0544fb1baeee61a3dcc7334c4548103328751a`. Implementation measured:
`1864673139345b6c86332a3a3d78fcde155602bb`. The harness uses the same dependency
versions and fixtures for both revisions. Measurements were taken on macOS arm64,
Node 24.15.0, React 19.2.6, Vite 8.0.13. Rendering and rerendering were treated as
critical priorities, following the Vercel React performance guidance.

## Results

| Workload                                                        |        Baseline |        Improved |
| --------------------------------------------------------------- | --------------: | --------------: |
| Initial production JavaScript                                   | 2,266,341 bytes | 1,316,850 bytes |
| Initial JavaScript, gzip (Node default compression)             |   710,866 bytes |   403,678 bytes |
| React render work, 30 name edits                                |       396.10 ms |        79.03 ms |
| React render work, 30 equipment updates                         |       472.12 ms |        19.89 ms |
| Total measured time, 30 name edits                              |       524.92 ms |       125.84 ms |
| Total measured time, 30 equipment updates                       |       617.29 ms |        37.26 ms |
| Sheet commits per 30 updates                                    |              60 |              30 |
| Untouched Abilities subtree updates per 30 name/equipment edits |              30 |               0 |
| Untouched tab subtree updates per 30 equipment edits            |              30 |               0 |
| Hourly history check: 5,000 sheets, none due                    |       115.09 ms |         3.23 ms |
| Weekly history check: 5,000 unchanged sheets, all due           |       471.37 ms |       249.87 ms |
| Group's latest 200 rolls among 100,000 rows / 20 groups         |         9.79 ms |         0.36 ms |

Times are warm-run medians. Raw samples and query plans are in
`scripts/performance/*results.json` and the baseline/optimized JSON and JSONL files
alongside them. This is a shared development machine: timings vary with other
work. The deterministic findings are the eliminated subtree renders, reduced
commit count, exact bundle bytes, and SQLite query plans. These results are not
production p95 latency or browser INP measurements.

The production browser comparison independently confirmed the initial bundle byte
counts in three cold-cache samples. Thirteen real name keystrokes produced 77 → 9
observed DOM mutation records; median beforeinput-to-DOM-commit time was
1.9 → 0.9 ms. A reload preserved the edited sheet. Mutation records are an
observer batching metric, not React render counts, and DOM commit latency does not
include paint. Collaborative preview paint scheduling is variable, so no FCP/INP
improvement is claimed.

## Findings and changes

- **Whole-sheet subscriptions propagated every edit through all sections.** The
  sheet shell now subscribes only to its stable delete action; the page subscribes
  to the undo availability boolean rather than the entire undo history. Tabs
  observe names and stable UUIDs. Their names still update immediately, but
  equipment, stress, and ability edits no longer rerender them.
- **Unchanged Markdown was reparsed during unrelated updates.** The shared
  Markdown renderer now memoizes its string and primitive props. The name/class/
  calling section reads bonus, equipment, and resource data when the confirmation
  handler runs, instead of subscribing to fields it never displays. This also
  uses the freshest sheet data when applying class/calling traits.
- **Export and play libraries loaded on the ordinary sheet route.** PDF creation
  loads on demand, and Play Mode uses a lazy component with a loading status.
  The deferred chunks contain approximately 427 KB of PDF code and 523 KB of
  Play Mode/Three.js code. Total JavaScript remains approximately 2.27 MB; the
  improvement removes 42% of the initial raw payload rather than deleting
  features. A first export or Play Mode visit requires its additional chunk.
- **Dice sharing listened to every character object.** Its displayed name and
  current cloud UUID use primitive selectors, avoiding unrelated text updates.
- **Hourly history work loaded all JSON and made one checkpoint query per
  character.** A left join filters new/due sheets before loading JSON, while
  retaining the same immediate transaction, weekly cadence, semantic hashing,
  and 28-day expiry. Even the all-due workload eliminates 5,000 separate reads.
- **Group roll reads scanned and sorted the full table.** Migration
  `0009_sweet_wildside.sql` adds `roll_events(group_id, created_at)`. SQLite now
  seeks into the group and walks its timestamp order instead of doing a full
  table scan and temporary sort. The index adds storage/write maintenance; it
  does not change authorization, return values, or retention.

No persistence writes were deferred or batched. Browser-only sheets, archives,
undo checkpoints, UUIDs, ownership, and conflict-safe sync retain their existing
behavior. No production data or remote infrastructure was accessed.

## Reproduce

Install dependencies with `pnpm install --frozen-lockfile` at the root and in
`backend/`. Run these from the repository root (commands also work in fish):

```sh
node scripts/performance/compare-render.mjs 8a0544f
pnpm run build
node scripts/performance/bundle.mjs
pnpm --dir backend exec tsx scripts/benchmark-history.ts 8a0544f
pnpm --dir backend exec tsx scripts/benchmark-history.ts
pnpm --dir backend exec tsx scripts/benchmark-rolls.ts 8a0544f
pnpm --dir backend exec tsx scripts/benchmark-rolls.ts
```

`compare-render.mjs` extracts baseline source into a temporary directory, executes
the same mounted CharacterSheet harness against both sources, and removes the
temporary tree. The fixture contains 30 Witch sheets, each with 30 Markdown
abilities. Each update is flushed with React `act`; one warm-up sample is
discarded and five samples of 30 updates are measured. Nested Profilers wrap
the actual Abilities and tabs components. PostHog is stubbed; DOM/layout is jsdom.
Name changes represent the store work performed by its input; equipment updates
measure field changes with the Markdown preview mounted, not typing into an open
textarea. LocalStorage persistence is included in elapsed time.

The history harness calls the actual capture implementation in a disposable
in-memory SQLite database with 5,000 approximately 6 KB sheets. It measures 15
not-due samples and six all-due samples after warm-up. Its baseline argument loads
the exact historical capture source. The roll harness migrates either the
baseline or current schema into its own in-memory database, executes the same
Drizzle query as the group overview endpoint, and records 20 samples after
warm-up plus `EXPLAIN QUERY PLAN`. Backend numbers exclude HTTP, authentication,
network latency, and response serialization.

For a baseline production bundle, build the baseline revision in a separate
checkout with the same lockfile and environment, then pass that `dist/` directory
to `bundle.mjs`. The bundle report measures script/modulepreload entries in
`index.html`; this build has no other eager JavaScript chunks. Images and CSS are
reported by Vite separately and are outside the JavaScript byte comparison.

## Validation and remaining work

Frontend typecheck, lint, changed-code formatting, production build, and all 30
persistence/sync tests passed. Backend build and all seven tests passed, including
mixed new/not-due/deleted checkpoints and the exact seven-day boundary. Generated
schema/migrations apply successfully in disposable databases. Browser checks cover
actual name input, reload persistence, and the sheet layout. A separate production
smoke build used a fresh migrated local database and backend, without changing the
measured build/environment. Its first PDF export requested the 426,734-byte lazy
chunk and produced a 137,895-byte `application/pdf` Blob with the edited character
name in the filename. The browser download anchor was intercepted to inspect the
artifact. Local test sign-in succeeded, and the first authenticated `/play` visit
requested the 522,816-byte lazy chunk and rendered group creation. Creating a test
group automatically assigned the active sheet and showed its live table with one
online owner. No feature exception was observed. Raw evidence is saved in
`scripts/performance/lazy-smoke.json`.

Independent subagent review checked the source diff, generated migration/schema,
benchmark harnesses, and backend tests. Its recommendation to exercise the lazy
PDF and authenticated Play Mode entry points was implemented with the smoke check
above. The follow-up review found no remaining valuable actionable recommendations.

The root formatter was run; its unrelated pre-existing workflow indentation
change was discarded, and formatting for `src`, `backend`, and `scripts` was
checked separately. The ordinary sheet bundle still contains analytics,
Markdown, router/UI libraries, and static game rules. Further chunking needs
interaction measurements and careful preservation of offline sheet access;
blanket memoization or delayed browser saves were not justified by this audit.

## All routes and views follow-up

The expanded audit starts at `545bb09` (the completed first pass); implementation
is `1252dcf`. Earlier comparisons above remain historical first-pass results.
Baseline production assets and source were retained outside git before edits at
`../hiveborn-all-views-baseline-build`. Production builds use the same lockfile,
`VITE_API_URL=http://localhost:3312`, and no frontend analytics key. The optional
analytics SDK remains in common startup: changing its identity/consent ordering
was not justified while route isolation already substantially shrinks startup.

### Production route JavaScript

Static import closures count each JS asset once, excluding optional PDF and 3D
animation chunks, images and CSS. Browser checks independently confirmed all
public closures in three full navigations with caching disabled. Authenticated
Play was checked against a fresh local backend/database. The anonymous guard is
separate from the authenticated group view.

| Entry/view                                  | Before raw JS bytes | After raw JS bytes | Result                                                |
| ------------------------------------------- | ------------------: | -----------------: | ----------------------------------------------------- |
| Common bootstrap                            |           1,316,850 |            717,568 | Sheet/rule UI moves behind routes                     |
| `/` sheet                                   |           1,316,850 |          1,316,972 | Essentially flat; no second-pass startup gain claimed |
| `/auth/callback`                            |           1,316,850 |            718,344 | 45.4% less JS                                         |
| Anonymous `/play` or `/play/$groupId` guard |           1,316,850 |            750,753 | 43.0% less JS                                         |
| Authenticated `/play` group list/table      |           1,839,666 |          1,066,709 | 42.0% less JS                                         |
| Authenticated `/play/$groupId` detail       |           1,839,666 |          1,066,709 | Same shared route closure                             |

Group UI loads only after authentication. This adds a small lazy-module hop for
first authenticated entry, accepted to keep table references and sheet viewers
out of the anonymous guard. Three.js loads when a GM actually rolls fallout;
PDF remains on demand. Shared loaded modules are reused across navigation.

### Mounted rendering and backend measurements

The harness mounts the actual GroupOverview, cards and Markdown components in
jsdom: 12 groups, 30 assigned characters and 200 rolls. It performs ten actual
input/store/timer/server/route updates per sample, discards one warm-up round,
and records three rounds per run. Two baseline/after pairs reverse run order,
producing six samples per variant. Timers advance the ten-second age tick and
existing fifteen-second refresh together. Markdown counts measure entries into
a thin wrapper around the real memoized Markdown component, not parser calls.
Profiler time is React render work, not browser paint, INP or layout. Concurrent
builds/tests on this machine make timings illustrative; deterministic child
work and bytes are the primary outcomes.

| Workload, 10 updates/sample                    | Unchanged Markdown subtree entries before → after | Play commits before → after | Median React render ms before → after |
| ---------------------------------------------- | ------------------------------------------------: | --------------------------: | ------------------------------------: |
| Invite nickname input                          |                                           310 → 0 |                     10 → 10 |                        123.06 → 55.90 |
| New group name input                           |                                           310 → 0 |                     10 → 10 |                        125.84 → 61.27 |
| Ten-second age ticks plus scheduled refresh    |                                       496–527 → 0 |               16–17 → 16–17 |                       198.07 → 103.74 |
| Local sheet equipment edits while Play mounted |                                           310 → 0 |                      10 → 0 |                         125.24 → 0.00 |
| Server changes one other-player sheet          |                                          310 → 10 |                     10 → 10 |                        113.67 → 81.59 |
| Switch between populated groups                |                                         310 → 310 |                     10 → 10 |                       117.37 → 117.48 |

Server-update and group-switch workloads assert changed names/headings in the
DOM. Group switching deliberately refreshes callbacks, permissions and cards;
it shows no deterministic rendering gain, and no speedup is claimed. A separate
mounted regression verifies that an already-open shared sheet displays fresh
abilities/name and closes when switching to a table without that sheet.

The equipment tag reference is an audited unchanged case: its real dialog has
26 bounded tags, memoized relevance/search blobs and local search state. Ten
search edits produce twenty commits before and after; extra caching/debouncing
would add complexity without removing a measured bottleneck.

The actual authenticated `/play-groups` HTTP route is injected into Fastify over
an in-memory migrated SQLite fixture: 20 groups, 100 saved sheets, five assigned
sheets per group. The new overview loader batches group/member/assigned-sheet
reads and parses each unique assigned sheet once. It still uses one indexed,
limited roll read per group to retain 200-roll limits for both busy and quiet
tables. Queries fall **122 → 25**, identical response size **1,318,269 bytes**;
14 samples per variant have median route times **18.793 → 6.612 ms**. This
includes authentication and response serialization, excludes TCP/network and
production data. Membership, assignment, deletion, requested ordering, online
status and independent roll limits have regression coverage.

Fallout lowest-point geometry math now reuses one Vector3 per animation rather
than one per vertex per frame. Exact historical math is loaded from git; 100
rotations give identical results. Six interleaved 1,000-frame samples eliminate
**108,000 vertex-vector allocations → 0**, with identical checksums. Allocation
instrumentation runs separately from timing; this is CPU math, not WebGL FPS.
Quaternion/path scratch values are also reused. Existing idle-rAF stop,
ResizeObserver disconnect and geometry/material/texture/renderer disposal remain
intact. A failed optional animation import is caught immediately and cannot skip
stress/result reconciliation after a successful server mutation.

### Coverage matrix

Every registered route and major view was inventoried. “Audited unchanged” means
source/lifecycle/dataflow review with no beneficial performance change justified;
it does not assert a measured latency improvement. Historical sheet measurements
remain the first-pass evidence. Browser smoke checks are feature validation,
not a benchmark. No real OAuth provider or production account was used.

| Route/view                                                                   | Concrete workload/check                                       | Outcome/evidence                                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Shared startup, theme, Toaster, analytics identity                           | Cold route navigation; consent/identity dataflow              | Route bytes above; SDK ordering preserved                                                      |
| `/` ordinary sheet                                                           | Name/equipment updates, reload persistence                    | First-pass narrow subscriptions retained; second-pass route size flat                          |
| Name/class/calling selection and apply-core-traits dialogs                   | Selector/picker/core-trait state audit                        | Audited unchanged bounded static choices                                                       |
| Abilities minor/major/zenith tabs, search and pickers                        | Unrelated name/equipment updates; picker dependencies         | First-pass actual Abilities commits 30 → 0; bounded selected-class choices unchanged           |
| Active beats minor/major/zenith tabs                                         | Calling/beat selection and Markdown dependencies              | Audited unchanged; current-calling data only                                                   |
| Stress/protection controls, skills/domains/knacks                            | Local field updates and selector ownership                    | First-pass subscriptions preserved; small fixed field grids                                    |
| Equipment/resources Markdown editors                                         | Local equipment benchmark, tag relevance source dependencies  | First-pass memo Markdown retained; Play ignores unrelated local text edits                     |
| Sheet equipment/resource tag dialogs                                         | Mounted real search; native search/filter                     | 20 commits → 20; audited local bounded search unchanged                                        |
| Sheet fallout selector/reference                                             | Static fallout selection/state audit                          | Closed contents unmounted; bounded rules unchanged                                             |
| Dice skill/free/stress tabs and result overlay                               | Event-time sheet reads, broadcast and tab subscriptions       | First-pass event reads preserved; no new delayed writes                                        |
| Desktop/mobile character tabs and delete confirmation                        | 30-sheet first-pass fixture; name/identity slice              | Equipment updates cause no tab commits; delete handler reads current state                     |
| Create/load sheet, JSON import/export, PDF export                            | Persistence/schema checks and first-use PDF smoke             | First-pass PDF remains deferred; no browser persistence batching                               |
| Deleted-character recovery/archive, reset and undo                           | Persistence/sync regression suite and action audit            | Ownership/conflict-safe restore invariants preserved; audited unchanged                        |
| Copyright/privacy/consent dialogs and theme toggle                           | Closed-dialog mount and theme/consent audit                   | Cheap local state; no extra network or broad store subscription introduced                     |
| Account nickname/sign-out, local authentication                              | Native nickname save and refreshed owner label                | Feature smoke passed; small isolated form unchanged                                            |
| `/auth/callback` missing-code/error/success handling                         | Native missing-code smoke; mounted auth-context rerender      | Reduced bytes; stable refresh dependency prevents repeating one-time code exchange             |
| Anonymous Play guard                                                         | Three independent uncached route navigations                  | GroupOverview and table rule chunks omitted                                                    |
| `/play` empty state and create-group forms                                   | Native creation; mounted group-name input                     | Creates/autoassigns active sheet; 310 → 0 unchanged Markdown entries                           |
| Group sidebar/list, mobile group/sheet selects                               | Native two-group navigation; mounted route switching          | Current heading/cards/permissions verified; no switch-time gain claimed                        |
| Incoming invitations accept/decline                                          | Native incoming invitation accept/decline                     | Batched overview preserves response; cheap invitation list unchanged                           |
| Invite-by-nickname form and errors                                           | Native known-member/missing-user requests; mounted typing     | Immediate form state; zero unrelated card Markdown work                                        |
| Owner GM controls and GM-only stress preference                              | Native multi-member GM table; mounted permission/group change | Callback/permission comparisons included; conditional controls refresh                         |
| Show-other-players-beats preference                                          | Per-user storage key and memo prop audit                      | `showBeats` invalidates cards/modal; preference scope preserved                                |
| Assign/remove own sheets and open-own-sheet action                           | Native autoassignment; action/cloud-ID dependency audit       | Live cloud IDs/ownership retained; response updates batched backend                            |
| Member character cards and online status                                     | Unrelated input/ticks; single remote sheet change             | Memo compares data/version/name/identity/status/permissions/callbacks; live card update passes |
| Shared read-only sheet: identity, stress, fallout, abilities, skills/domains | Native opening and mounted live-refresh regression            | Fresh selected-ID lookup; all displayed sheet data updates while open                          |
| Shared sheet equipment/resources and nested relevant tags                    | Native shared-sheet view; dependency audit                    | Fresh sheet drives relevance; bounded local dialog work unchanged                              |
| Recent roll feed, former-character columns, expiry                           | 200-roll tick workload and single grouped map audit           | Memoized feed; one map groups rolls rather than per-column repeated scans                      |
| GM fallout reference/manual assignment/autoassign/undo                       | Native Battered assignment; handler/eligibility audit         | Successful assignment displayed; authorization/undo paths preserved                            |
| GM animated fallout result                                                   | First-use lazy import, canvas mount/removal; math benchmark   | Three deferred; allocations removed; chunk-failure reconciliation tested                       |
| Backend auth/account, sheet sync/conflict/deletion/history                   | Existing and added frontend/backend regression suites         | Existing boundaries/cadence preserved; no production database touched                          |
| Backend Play group overview and roll reads                                   | Actual authenticated route fixture + assignment/limit tests   | Batched overview 122 → 25 queries; first-pass roll index retained                              |

### Follow-up reproduction and validation

```sh
node scripts/performance/compare-views.mjs 545bb09
pnpm --dir backend exec tsx scripts/benchmark-groups.ts 545bb09
pnpm --dir backend exec tsx scripts/benchmark-groups.ts
backend/node_modules/.bin/tsx scripts/performance/fallout-math.ts 545bb09
env -u VITE_PUBLIC_POSTHOG_KEY VITE_API_URL=http://localhost:3312 pnpm exec vite build --manifest --outDir ../hiveborn-all-views-build
node scripts/performance/route-bytes.mjs ../hiveborn-all-views-build
```

Build the baseline revision in an isolated checkout with the same environment
and `--manifest`; pass its retained directory to `route-bytes.mjs`. That tool
recursively follows only static imports and deduplicates them. Both public guard
and authenticated group closures are listed. The comparison runner extracts the
historical source, runs identical mounted fixtures in alternating order, records
Node/platform/revision metadata and removes the temporary directory. Raw results
are `scripts/performance/allviews-comparison.json`, `allviews-routes-*.json`,
`fallout-math-comparison.json`, and `allviews-browser-*.json`. Initial backend
baseline/after records are also retained separately as `groups-allviews-*.jsonl`.

Native production smoke ran on frontend5342/backend3312 with an explicitly
separate `../hiveborn-all-views-data/hiveborn.sqlite`. Runtime analytics and
WorkOS keys were disabled. `seed-allviews-smoke.ts` refuses any other database
path and seeds synthetic players only. Native checks covered incoming invitation accept/decline, group create/switch,
read-only shared sheet, reference search, manual fallout assignment, first-use
animation, server roll feed, account nickname and callback error. Screenshots
and details are recorded in `scripts/performance/allviews-smoke.json`. Browser
background throttling precludes animation/FCP/INP latency claims. One canvas was
observed mounted and removed after its overlay; detailed resource cleanup is
also checked in source.

Frontend formatting/lint/typecheck, production build and all 33 tests passed;
backend build and all eight tests passed. New regressions cover assignment and
membership scoping, busy/quiet roll limits, live shared-sheet refresh, permission
changes on group switching, optional animation failure and one-time OAuth code
exchange. No network send/push/PR or production changes were performed.
