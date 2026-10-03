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
