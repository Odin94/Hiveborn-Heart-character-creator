# H01 — A clean remote update creates and uploads a duplicate sheet

Severity: **High**. Confirmed through local sign-in, API, WebSocket, and browser store at `8a0544f`.

Revalidated on committed revision `545bb09` after incorporating the newer local performance work. Uncommitted architecture changes in the primary checkout were outside this review.

## Reproduction and evidence

1. Sign in locally and let a named character finish syncing.
2. Update its equipment from another client, using the current base and revision.
3. Wait for the first client's live sync.

The original browser had no pending edits. Its one sheet becomes two: an old sheet with empty equipment under a new UUID, and the server sheet with `REMOTE CLEAN EQUIPMENT`. The duplicate is automatically uploaded. In this run the original UUID ended in `c236`; the new UUID ended in `f290`.

## Cause

`src/lib/characterSync.ts:reconcileCharacters` recognizes the case where only the browser changed, but lacks the reciprocal case where local equals the confirmed base and only the server changed. It treats that as divergence and forks the old local sheet. `useCloudCharacterSync` subsequently uploads the fork.

## Suggested fix

Before the divergent branch, compare local with its confirmed base for the same account. If they match, adopt the newer server document and revision. Keep forking for actual conflicting edits, and consider merging disjoint edits. Preserve active selection by UUID when the list changes.

Regression: a clean remote edit, including a GM stress/fallout update, must update one sheet without creating another database row.
