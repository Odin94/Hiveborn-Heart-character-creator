# H04 — Editing in a second tab silently overwrites the first tab's browser data

Severity: **High**. Confirmed using two real anonymous browser tabs at `8a0544f`; reproduction: `../../../harness/cross-tab.js`.

## Reproduction and evidence

Open the same saved browser character in A and B. Edit equipment in A. B does not receive that change. Edit the name in B. Its persist middleware writes its entire stale character array back to the shared localStorage key. Reload A: its equipment edit is gone. The test waited for propagation before editing B and used an isolated context without cloud sync.

The same mechanism can resurrect deletions and discard newly imported characters or durable recovery entries created in the other tab.

## Cause

`src/hiveborn/character_sheet/character_states.ts` uses Zustand `persist` with `hiveborn-character-storage`, without a `storage` event handler or any merge/concurrency protection. The full collection is rewritten on every store update.

## Suggested fix

Persist records and revisions by UUID, coordinate writes across tabs with Web Locks or an IndexedDB transaction, and reconcile storage/BroadcastChannel updates without discarding dirty records. Preserve divergent documents rather than blindly calling rehydrate, which would also overwrite pending edits.

Regression: two anonymous tabs editing disjoint fields, simultaneous imports, deletion/recovery, and tab reload. Both edits and every character must remain recoverable.
